import { readonly, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'

const BAUD_RATE = 115200 // must match the ESP32 (same rate as its logs)

// One connection for the whole app: state lives outside useSerial(),
// so every component sees the same port (like theme.ts).
let port: SerialPort | undefined // native object, deliberately not reactive (a Proxy breaks it)
let nextId = 1 // never reset, so a late reply from an old request can't match a new one
const connected = ref(false)
// Logs every line from the device to the console. Stored, so it survives a reload.
// Console: localStorage.setItem('serial-debug', 'true'), then reload
const debug = useLocalStorage('serial-debug', false)
const paired = ref(false) // the browser remembers a device this page may open without asking
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
          if (debug.value) console.log('[esp]', line)
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

// Resolves with the first line starting with `prefix`, or undefined after the timeout
function waitForLine(prefix: string, timeoutMs: number): Promise<string | undefined> {
  return new Promise((resolve) => {
    const handler = (line: string) => {
      if (!line.startsWith(prefix)) return
      clearTimeout(timer)
      lineHandlers.delete(handler)
      resolve(line.trim())
    }
    const timer = setTimeout(() => {
      lineHandlers.delete(handler)
      resolve(undefined)
    }, timeoutMs)
    lineHandlers.add(handler)
  })
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

async function send(text: string) {
  if (!port?.writable) return

  // Lock the stream only for this one message, so the next send() can lock it again
  const writer = port.writable.getWriter()
  try {
    await writer.write(new TextEncoder().encode(text + '\n')) // '\n' ends a line on the ESP32
  } finally {
    writer.releaseLock()
  }
}

const supported = typeof navigator !== 'undefined' && 'serial' in navigator
let opening = false // auto-connect and a click must not open the port twice

async function refreshPaired() {
  paired.value = supported && (await navigator.serial.getPorts()).length > 0
}

// Opens `p` and runs the handshake. Returns false if the device did not answer.
async function openPort(p: SerialPort, { forgetOnNoAnswer = false } = {}) {
  if (connected.value || opening) return false
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
    // so ask "PING" every 500 ms until it answers "READY"
    let ready: string | undefined
    for (let attempt = 0; attempt < 10 && !ready; attempt++) {
      const answer = waitForLine('READY', 500) // listen before asking, so no answer is missed
      await send('PING')
      ready = await answer
    }
    if (!ready) {
      await closePort()
      // A freshly picked device that never answers is not a Clausage: don't keep it paired
      if (forgetOnNoAnswer) await p.forget?.()
      console.error('[serial] No answer from the device. Is the Clausage firmware running?')
      return false
    }

    deviceVersion.value = ready.split(' ')[1] // "READY 0.1.0" -> "0.1.0"
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
    return openPort(picked, { forgetOnNoAnswer: true })
  }

  async function disconnect() {
    if (!port) return
    await closePort()
  }

  // Disconnects and removes the pairing, so the next connect() asks again
  async function forgetDevice() {
    await closePort()
    for (const known of await navigator.serial.getPorts()) await known.forget?.()
    await refreshPaired()
  }

  async function changeDevice() {
    await forgetDevice()
    return connect()
  }

  // Sends { id, cmd, ...params } and resolves with the reply carrying the same id,
  // or undefined after the timeout
  async function request<T = DeviceMessage>(
    cmd: string,
    params: Record<string, unknown> = {},
    timeoutMs = 3000,
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
    debug,
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
  }
}
