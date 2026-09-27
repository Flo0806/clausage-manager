import { readonly, ref } from 'vue'
import { recordLine } from './debugLog.ts'

const BAUD_RATE = 115200 // must match the ESP32 (same rate as its logs)

// One connection for the whole app: state lives outside useSerial(),
// so every component sees the same port (like theme.ts).
let port: SerialPort | undefined // native object, deliberately not reactive (a Proxy breaks it)
let nextId = 1 // never reset, so a late reply from an old request can't match a new one
const connected = ref(false)
const paired = ref(false) // the browser remembers a device this page may open without asking
// A port that opened fine but no Clausage answered: a new board (or a broken install) to install on
let blankPort: SerialPort | undefined
const blank = ref(false)
const deviceVersion = ref<string>() // firmware version reported in the handshake

// Reading: a loop runs in the background and hands every complete line to the handlers
let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
let readLoopDone: Promise<void> | undefined
const lineHandlers = new Set<(line: string) => void>()

async function readLoop(p: SerialPort) {
  const decoder = new TextDecoder()
  let pending = '' // bytes arrive in chunks, so a line can be split across reads

  // p.readable is recreated after a recoverable error (e.g. buffer overrun)
  while (p.readable) {
    reader = p.readable.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) return // reader.cancel() was called by closePort()
        pending += decoder.decode(value, { stream: true })
        const lines = pending.split(/\r?\n/)
        pending = lines.pop() ?? '' // the last part is not complete yet
        lines.forEach((line) => {
          recordLine('in', line)
          lineHandlers.forEach((handle) => handle(line))
        })
      }
    } catch (e) {
      console.error('[serial] read error', e)
    } finally {
      reader.releaseLock()
    }
  }
}

// Messages for us are JSON objects with either "id" (reply to a request) or "event" (broadcast)
export interface DeviceMessage {
  id?: number
  event?: string
  [key: string]: unknown
}
type MessageListener = (message: DeviceMessage) => void

const pendingReplies = new Map<number, MessageListener>()
const eventListeners = new Map<string, Set<MessageListener>>()

function handleLine(line: string) {
  if (!line.trim()) return

  let message: unknown
  try {
    message = JSON.parse(line)
  } catch {
    message = undefined
  }
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    console.debug('[serial] ignored:', line)
    return
  }

  const { id, event } = message as DeviceMessage
  if (typeof id === 'number') {
    const resolve = pendingReplies.get(id)
    if (resolve) resolve(message as DeviceMessage)
    else console.debug('[serial] nobody waits for id', id)
  } else if (typeof event === 'string') {
    eventListeners.get(event)?.forEach((listener) => listener(message as DeviceMessage))
  } else {
    console.debug('[serial] ignored (no id or event):', line)
  }
}
lineHandlers.add(handleLine)

async function closePort() {
  await reader?.cancel().catch(() => {}) // ends the read loop
  await readLoopDone
  await port?.close().catch(() => {})
  port = undefined
  reader = undefined
  readLoopDone = undefined
  connected.value = false
  deviceVersion.value = undefined
}

// Writes raw bytes; throws if the port is gone
async function writeBytes(bytes: Uint8Array) {
  if (!port?.writable) throw new Error('port not writable')

  // Lock the stream only for this one write, so the next one can lock it again
  const writer = port.writable.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
}

// Firmware bytes during an update go through writeBytes() directly and are not logged
async function send(text: string) {
  if (!port?.writable) return
  recordLine('out', text)
  await writeBytes(new TextEncoder().encode(text + '\n')) // '\n' ends a line on the ESP32
}

// The device refused or the update failed; `reason` is its error code (e.g. "verify", "cannot_update")
export class DeviceError extends Error {
  constructor(public reason: string) {
    super(reason)
  }
}

// Resolves on the first "update" event for which `until` is true; rejects on state "failed"
// or after the timeout. Other events and log lines in between are ignored.
function waitForUpdateEvent(
  until: (message: DeviceMessage) => boolean,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const listeners = eventListeners.get('update') ?? new Set<MessageListener>()
    eventListeners.set('update', listeners)
    const finish = (settle: () => void) => {
      clearTimeout(timer)
      listeners.delete(listener)
      settle()
    }
    const listener: MessageListener = (message) => {
      if (message.state === 'failed') finish(() => reject(new DeviceError(String(message.error))))
      else if (until(message)) finish(resolve)
    }
    const timer = setTimeout(
      () => finish(() => reject(new Error(`no update event within ${timeoutMs} ms`))),
      timeoutMs,
    )
    listeners.add(listener)
  })
}

const UPDATE_CHUNK_SIZE = 4096 // must match the firmware

// While true, nothing else may be sent: the device would write it into the firmware
const updating = ref(false)

// Sends { id, cmd, ...params } and resolves with the reply carrying the same id,
// or undefined after the timeout
async function request<T = DeviceMessage>(
  cmd: string,
  params: Record<string, unknown> = {},
  timeoutMs = 3000,
): Promise<T | undefined> {
  if (updating.value) {
    console.debug('[serial] request refused, update running:', cmd)
    return undefined
  }
  return sendRequest<T>(cmd, params, timeoutMs)
}

// Without the update lock: only for the "update" command itself
async function sendRequest<T>(
  cmd: string,
  params: Record<string, unknown>,
  timeoutMs: number,
): Promise<T | undefined> {
  const id = nextId++
  const reply = new Promise<T | undefined>((resolve) => {
    const timer = setTimeout(() => {
      pendingReplies.delete(id)
      resolve(undefined)
    }, timeoutMs)
    pendingReplies.set(id, (message) => {
      clearTimeout(timer)
      pendingReplies.delete(id)
      resolve(message as T)
    })
  })
  await send(JSON.stringify({ id, cmd, ...params }))
  return reply
}

const supported = typeof navigator !== 'undefined' && 'serial' in navigator
let opening = false // auto-connect and a click must not open the port twice

async function refreshPaired() {
  paired.value = supported && (await navigator.serial.getPorts()).length > 0
}

// Opens `p` and runs the handshake. Returns false if the device did not answer or the port is busy.
async function openPort(p: SerialPort) {
  // During an update or install the port belongs to that, not to auto-connect
  if (connected.value || opening || updating.value) return false
  opening = true
  try {
    port = p
    await port.open({ baudRate: BAUD_RATE })
    readLoopDone = readLoop(port)

    // Cable unplugged: reset the state, otherwise connect() thinks we are still connected
    const openedPort = port
    openedPort.addEventListener('disconnect', () => {
      if (port === openedPort) void closePort()
    })

    // Handshake: the ESP32 may still be booting (opening the port can reset it),
    // so ask "info" every 500 ms until it answers
    let ready: { ok: boolean; version: string } | undefined
    for (let attempt = 0; attempt < 10 && !ready?.ok; attempt++) {
      ready = await request<{ ok: boolean; version: string }>('info', {}, 500)
    }
    if (!ready?.ok) {
      await closePort()
      // The port works, the firmware doesn't answer: offer to install Clausage on it
      blankPort = p
      blank.value = true
      console.error('[serial] No answer from the device. Is the Clausage firmware running?')
      return false
    }

    deviceVersion.value = ready.version
    blankPort = undefined
    blank.value = false
    connected.value = true
    return true
  } catch (e) {
    // Port busy (e.g. idf monitor still running): keep the pairing, it is the right device
    console.error('[serial]', e)
    await closePort()
    return false
  } finally {
    opening = false
    await refreshPaired()
  }
}

// Connects to an already paired device without asking (after reload or when plugged in)
async function autoConnect() {
  const [known] = await navigator.serial.getPorts()
  if (known) await openPort(known)
}

if (supported) {
  void refreshPaired().then(autoConnect)
  navigator.serial.addEventListener('connect', (e) => void openPort(e.target as SerialPort))
}

export function useSerial() {
  // Asks the user to pick a device (needs a click), then connects.
  // Returns true when connected, false when the device failed, undefined when nothing was picked.
  async function connect(): Promise<boolean | undefined> {
    if (connected.value) return true
    if (!supported) {
      console.error('[serial] Web Serial is not supported in this browser')
      return undefined
    }
    let picked: SerialPort
    try {
      picked = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x10c4 }, // CP210x USB-serial chip (current ESP32 board)
          { usbVendorId: 0x303a }, // Espressif native USB (ESP32-S3 board)
        ],
      })
    } catch {
      return undefined // dialog closed without picking a device
    }
    return openPort(picked)
  }

  async function disconnect() {
    if (!port) return
    await closePort()
  }

  // Disconnects and removes the pairing, so the next connect() asks again
  async function forgetDevice() {
    await closePort()
    for (const known of await navigator.serial.getPorts()) await known.forget?.()
    blankPort = undefined
    blank.value = false
    await refreshPaired()
  }

  // Hands the blank port to the installer (esptool-js) and keeps everything else off it
  // until endInstall(). Our own connection must be closed, esptool needs the port alone.
  async function beginInstall() {
    if (!blankPort || updating.value) return undefined
    updating.value = true
    await closePort()
    return blankPort
  }

  function endInstall() {
    updating.value = false
  }

  async function changeDevice() {
    await forgetDevice()
    return connect()
  }

  // Sends a firmware image: {"cmd":"update","size":n} -> ok, then 4096-byte chunks, each confirmed by
  // {"event":"update","received":bytes}, finally {"event":"update","state":"done"} (or "failed").
  // After "done" the device restarts; the port is closed here, reconnect() brings it back.
  async function flashFirmware(
    image: Uint8Array,
    { onErased, onProgress }: { onErased?: () => void; onProgress?: (done: number) => void } = {},
  ) {
    updating.value = true
    try {
      // Erasing the update slot takes a moment
      const reply = await sendRequest<{ ok: boolean; error?: string }>(
        'update',
        { size: image.length },
        15000,
      )
      if (!reply) throw new Error('no answer to "update" within 15000 ms')
      if (!reply.ok) throw new DeviceError(reply.error ?? 'unknown')
      onErased?.()

      let done: Promise<void> | undefined
      for (let offset = 0; offset < image.length; offset += UPDATE_CHUNK_SIZE) {
        const end = Math.min(offset + UPDATE_CHUNK_SIZE, image.length)
        const received = waitForUpdateEvent((m) => Number(m.received) >= end, 10000)
        // "done" can arrive right behind the last "received", so listen for it before the last chunk
        if (end === image.length) {
          done = waitForUpdateEvent((m) => m.state === 'done', 5000)
          done.catch(() => {}) // a "failed" is reported by `received` first; avoid an unhandled rejection
        }
        await writeBytes(image.subarray(offset, end))
        await received
        onProgress?.(end / image.length)
      }
      await done
    } finally {
      // Also after an error: a fresh connection resets the device's update state
      await closePort()
      updating.value = false
    }
  }

  // Tries to reconnect to the paired device until `timeoutMs` has passed
  async function reconnect(timeoutMs: number) {
    const end = Date.now() + timeoutMs
    while (!connected.value && Date.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await autoConnect()
    }
    return connected.value
  }


  function addListener(event: string, listener: MessageListener) {
    if (!eventListeners.has(event)) eventListeners.set(event, new Set())
    eventListeners.get(event)!.add(listener)
  }

  function removeListener(event: string, listener: MessageListener) {
    eventListeners.get(event)?.delete(listener)
  }

  // Calls `handler` for every line the device sends; returns a function to stop listening
  function receive(handler: (line: string) => void) {
    lineHandlers.add(handler)
    return () => lineHandlers.delete(handler)
  }

  return {
    connected: readonly(connected),
    updating: readonly(updating),
    blank: readonly(blank),
    paired: readonly(paired),
    deviceVersion: readonly(deviceVersion),
    connect,
    request,
    addListener,
    removeListener,
    receive,
    disconnect,
    forgetDevice,
    changeDevice,
    flashFirmware,
    reconnect,
    beginInstall,
    endInstall,
  }
}
