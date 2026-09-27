// A fake Clausage behind a fake Web Serial port: answers JSON commands and runs the
// update protocol like the firmware README describes. Tests steer it through `device`.

type Reply = Record<string, unknown> | undefined
type Handler = (command: Record<string, unknown>) => Reply

export interface FakeDevice {
  port: SerialPort
  // Answer for a command; undefined = stay silent
  handlers: Record<string, Handler>
  // Pushes a raw line to the app (events, log lines, garbage)
  emit: (line: string | Record<string, unknown>) => void
  // Everything the app sent as JSON commands
  commands: Record<string, unknown>[]
  // Update: bytes received, and how the update ends
  received: number
  updateResult: 'done' | { failed: string }
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function createFakeDevice(version = '1.0.0'): FakeDevice {
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let updateSize = 0 // > 0 while an update runs: incoming bytes are firmware, not text

  const device: FakeDevice = {
    port: undefined as unknown as SerialPort,
    handlers: {
      info: () => ({ ok: true, device: 'clausage', version, board: 'esp32s3-touch-lcd-2' }),
      update: (cmd) => {
        updateSize = Number(cmd.size)
        device.received = 0
        return { ok: true }
      },
    },
    emit: (line) => {
      const text = typeof line === 'string' ? line : JSON.stringify(line)
      controller?.enqueue(encoder.encode(text + '\n'))
    },
    commands: [],
    received: 0,
    updateResult: 'done',
  }

  function onBytes(bytes: Uint8Array) {
    if (updateSize > 0) {
      device.received += bytes.length
      device.emit({ event: 'update', received: device.received })
      if (device.received >= updateSize) {
        updateSize = 0
        const result = device.updateResult
        device.emit(
          result === 'done'
            ? { event: 'update', state: 'done' }
            : { event: 'update', state: 'failed', error: result.failed },
        )
      }
      return
    }
    for (const line of decoder.decode(bytes).split('\n')) {
      if (!line.trim()) continue
      const command = JSON.parse(line) as Record<string, unknown>
      device.commands.push(command)
      const reply = device.handlers[String(command.cmd)]?.(command)
      if (reply) device.emit({ id: command.id, ...reply })
    }
  }

  const port = {
    readable: null as ReadableStream<Uint8Array> | null,
    writable: null as WritableStream<Uint8Array> | null,
    async open() {
      port.readable = new ReadableStream<Uint8Array>({
        start: (c) => void (controller = c),
        cancel: () => void (controller = undefined),
      })
      port.writable = new WritableStream<Uint8Array>({ write: (chunk) => onBytes(chunk) })
    },
    async close() {
      port.readable = null
      port.writable = null
    },
    async forget() {},
    addEventListener() {},
    getInfo: () => ({ usbVendorId: 0x303a }),
  }
  device.port = port as unknown as SerialPort
  return device
}

// Installs navigator.serial so that connect() picks `device`. No paired ports, so importing
// serial.ts doesn't auto-connect behind the test's back.
export function installSerial(device: FakeDevice) {
  Object.defineProperty(navigator, 'serial', {
    configurable: true,
    value: {
      requestPort: async () => device.port,
      getPorts: async () => [],
      addEventListener() {},
    },
  })
}
