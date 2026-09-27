import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeviceMessage } from '@/composables/serial.ts'
import { createFakeDevice, installSerial, type FakeDevice } from './fakeDevice'

// serial.ts keeps one connection per module: a fresh module per test
async function connectedSerial(device: FakeDevice) {
  installSerial(device)
  vi.resetModules()
  const serial = await import('@/composables/serial.ts')
  const api = serial.useSerial()
  await api.connect()
  return { ...serial, api }
}

describe('serial protocol', () => {
  let device: FakeDevice
  beforeEach(() => {
    device = createFakeDevice('1.0.0')
  })

  it('connects with the "info" handshake and takes the version from it', async () => {
    const { api } = await connectedSerial(device)

    expect(api.connected.value).toBe(true)
    expect(api.deviceVersion.value).toBe('1.0.0')
    expect(device.commands[0]).toMatchObject({ cmd: 'info' })
  })

  it('gives up and stays disconnected when the device never answers', async () => {
    device.handlers.info = () => undefined
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.useFakeTimers()
    try {
      installSerial(device)
      vi.resetModules()
      const { useSerial } = await import('@/composables/serial.ts')
      const api = useSerial()
      const result = api.connect()
      await vi.advanceTimersByTimeAsync(10 * 500 + 100) // 10 attempts, 500 ms each
      expect(await result).toBe(false)
      expect(api.connected.value).toBe(false)
      expect(logged).toHaveBeenCalledWith(expect.stringContaining('No answer from the device'))
    } finally {
      vi.useRealTimers()
      logged.mockRestore()
    }
  })

  it('matches a reply to its request by id, whatever comes in between', async () => {
    device.handlers.hello = () => ({ ok: true, greeting: 'hi' })
    const { api } = await connectedSerial(device)
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})

    const reply = api.request<{ ok: boolean; greeting: string }>('hello')
    // Noise before the answer: a log line, an event, a reply for another id, broken JSON
    device.emit('I (1234) wifi: connected')
    device.emit({ event: 'mode', mode: 'active' })
    device.emit({ id: 9999, ok: true })
    device.emit('{not json')

    await expect(reply).resolves.toMatchObject({ ok: true, greeting: 'hi' })
    // The noise was seen and dropped, not handed on
    expect(debug).toHaveBeenCalledWith('[serial] ignored:', 'I (1234) wifi: connected')
    expect(debug).toHaveBeenCalledWith('[serial] nobody waits for id', 9999)
    expect(debug).toHaveBeenCalledWith('[serial] ignored:', '{not json')
    debug.mockRestore()
  })

  it('resolves undefined when no reply comes in time', async () => {
    device.handlers.hello = () => undefined
    const { api } = await connectedSerial(device)

    await expect(api.request('hello', {}, 50)).resolves.toBeUndefined()
  })

  it('hands events to their listeners, and only to those', async () => {
    const { api } = await connectedSerial(device)
    const onWifi = vi.fn<(message: DeviceMessage) => void>()
    const onToken = vi.fn<(message: DeviceMessage) => void>()
    api.addListener('wifi', onWifi)
    api.addListener('token', onToken)

    device.emit({ event: 'wifi', state: 'connected', ssid: 'HomeNet' })
    await vi.waitFor(() => expect(onWifi).toHaveBeenCalledOnce())

    expect(onWifi.mock.calls[0]![0]).toMatchObject({ state: 'connected', ssid: 'HomeNet' })
    expect(onToken).not.toHaveBeenCalled()

    api.removeListener('wifi', onWifi)
    device.emit({ event: 'wifi', state: 'disconnected', ssid: 'HomeNet' })
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(onWifi).toHaveBeenCalledOnce()
  })
})

describe('firmware update over serial', () => {
  // 3 full chunks and a short last one
  const image = new Uint8Array(3 * 4096 + 100).map((_, i) => i % 256)

  it('sends the image in 4096-byte chunks and finishes on "done"', async () => {
    const device = createFakeDevice()
    const { api } = await connectedSerial(device)
    const progress: number[] = []

    await api.flashFirmware(image, { onProgress: (done) => progress.push(done) })

    expect(device.commands[device.commands.length - 1]).toMatchObject({ cmd: 'update', size: image.length })
    expect(device.received).toBe(image.length)
    expect(progress).toHaveLength(4)
    expect(progress[progress.length - 1]).toBe(1)
    // The port is closed afterwards; the device restarts into the new firmware
    expect(api.connected.value).toBe(false)
    expect(api.updating.value).toBe(false)
  })

  it('refuses every other request while the update runs', async () => {
    const device = createFakeDevice()
    device.handlers.hello = () => ({ ok: true })
    const { api } = await connectedSerial(device)
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    let duringUpdate: unknown = 'not called'

    await api.flashFirmware(image, {
      onErased: () => {
        // Anything sent now would be written into the firmware
        void api.request('hello').then((reply) => (duringUpdate = reply))
      },
    })

    expect(duringUpdate).toBeUndefined()
    expect(device.commands.some((c) => c.cmd === 'hello')).toBe(false)
    expect(debug).toHaveBeenCalledWith('[serial] request refused, update running:', 'hello')
    debug.mockRestore()
  })

  it('rejects with the device reason when the update fails', async () => {
    const device = createFakeDevice()
    device.updateResult = { failed: 'verify' }
    const { api, DeviceError } = await connectedSerial(device)

    const result = api.flashFirmware(image)

    await expect(result).rejects.toBeInstanceOf(DeviceError)
    await expect(result).rejects.toMatchObject({ reason: 'verify' })
    expect(api.updating.value).toBe(false)
  })

  it('rejects when the device refuses to start the update', async () => {
    const device = createFakeDevice()
    device.handlers.update = () => ({ ok: false, error: 'cannot_update' })
    const { api } = await connectedSerial(device)

    await expect(api.flashFirmware(image)).rejects.toMatchObject({ reason: 'cannot_update' })
    expect(device.received).toBe(0) // not a single firmware byte went out
  })
})
