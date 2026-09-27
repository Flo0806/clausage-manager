import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { FirmwareRelease } from '@/composables/firmware.ts'
import { verify } from '@/composables/firmwareUpdate.ts'

// A minimal ESP32 app image: 0xE9, esp_app_desc_t magic at 32, version text at 48
function fakeImage(version: string, size = 512) {
  const image = new Uint8Array(size)
  image[0] = 0xe9
  new DataView(image.buffer).setUint32(32, 0xabcd5432, true)
  image.set(new TextEncoder().encode(version), 48)
  return image
}

function releaseFor(image: Uint8Array, version: string): FirmwareRelease {
  return {
    board: 'esp32s3-touch-lcd-2',
    version,
    file: 'x.bin',
    url: 'https://example.invalid/x.bin',
    size: image.length,
    sha256: createHash('sha256').update(image).digest('hex'),
    released: '2026-09-27',
  }
}

describe('firmware file check before sending', () => {
  it('accepts a matching image', async () => {
    const image = fakeImage('1.2.0')
    await expect(verify(image, releaseFor(image, '1.2.0'))).resolves.toBeUndefined()
  })

  it.each([
    ['size', (img: Uint8Array) => img.slice(0, -1)],
    ['hash', (img: Uint8Array) => img.map((b, i) => (i === 300 ? b ^ 1 : b))],
  ])('rejects a download that differs from the manifest (%s)', async (code, change) => {
    const image = fakeImage('1.2.0')
    const expected = releaseFor(image, '1.2.0')
    await expect(verify(change(image) as Uint8Array<ArrayBuffer>, expected)).rejects.toMatchObject({
      code,
    })
  })

  it('rejects a file that is not an ESP app image', async () => {
    const image = fakeImage('1.2.0')
    image[0] = 0x00
    await expect(verify(image, releaseFor(image, '1.2.0'))).rejects.toMatchObject({
      code: 'notFirmware',
    })
  })

  it('rejects an image without app description (e.g. bootloader)', async () => {
    const image = fakeImage('1.2.0')
    image[32] = 0x00
    await expect(verify(image, releaseFor(image, '1.2.0'))).rejects.toMatchObject({
      code: 'notFirmware',
    })
  })

  it('rejects an image whose version differs from the manifest', async () => {
    const image = fakeImage('1.1.0')
    await expect(verify(image, releaseFor(image, '1.2.0'))).rejects.toMatchObject({
      code: 'version',
      detail: '1.1.0',
    })
  })
})

describe('reading the manifest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function loadWith(response: Response) {
    vi.stubGlobal('fetch', vi.fn(async () => response))
    vi.resetModules()
    const { useFirmware } = await import('@/composables/firmware.ts')
    const firmware = useFirmware()
    await firmware.reload()
    return firmware
  }

  const entry = (version: string, released: string) => ({
    version,
    file: `firmware/b/clausage-${version}.bin`,
    size: 1,
    sha256: 'x',
    released,
  })

  it('reads a list per board and a single object, newest version first', async () => {
    const firmware = await loadWith(
      Response.json({
        boards: {
          // As numbers 0.10.0 is newer than 0.9.0, as text it would not be
          board_a: [entry('0.9.0', '2026-09-01'), entry('0.10.0', '2026-09-20')],
          board_b: entry('0.4.0', '2026-08-01'),
        },
      }),
    )

    expect(firmware.error.value).toBe(false)
    expect(firmware.releases.value.map((r) => `${r.board}@${r.version}`)).toEqual([
      'board_a@0.10.0',
      'board_a@0.9.0',
      'board_b@0.4.0',
    ])
    expect(firmware.releases.value[0]!.url).toBe(
      'https://raw.githubusercontent.com/Flo0806/clausage-firmware/main/firmware/b/clausage-0.10.0.bin',
    )
    expect(firmware.findRelease('board_b', '0.4.0')).toBeDefined()
  })

  it('flags an error when the manifest cannot be loaded', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const firmware = await loadWith(new Response('nope', { status: 500 }))

    expect(firmware.error.value).toBe(true)
    expect(firmware.releases.value).toEqual([])
    expect(logged).toHaveBeenCalledOnce()
    logged.mockRestore()
  })
})
