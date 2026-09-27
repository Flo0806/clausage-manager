import { computed, readonly, ref, watch } from 'vue'
import { until } from '@vueuse/core'
import { useSerial } from './serial.ts'
import { useDevice } from './device.ts'
import { useFirmware, type FirmwareRelease } from './firmware.ts'
import { download, sha256Hex } from './firmwareUpdate.ts'
import { recordLine } from './debugLog.ts'

// First install on a new board: the full image (bootloader, partition table, app, empty settings)
// goes to address 0 with esptool-js, which puts the chip into its ROM download mode itself.

export type InstallPhase =
  | 'idle'
  | 'download'
  | 'verify'
  | 'bootloader'
  | 'write'
  | 'restart'
  | 'check'
  | 'success'
  | 'failed'

// Keys under "install.error" in the locale files
export type InstallError =
  | 'noDevice'
  | 'noFirmware'
  | 'download'
  | 'size'
  | 'hash'
  | 'notImage'
  | 'bootloader'
  | 'wrongChip'
  | 'wrongFlash'
  | 'write'
  | 'notBack'
  | 'version'

// The only board Clausage runs on so far (Waveshare ESP32-S3-Touch-LCD-2)
const EXPECTED_CHIP = 'ESP32-S3'
const EXPECTED_FLASH = '16MB'
const IMAGE_CHIP_ID_S3 = 9 // byte 12 of the bootloader image header
const RESTART_TIMEOUT_MS = 20000

// Reset into the new firmware: DTR off (boot pin high = normal boot, not download mode),
// RTS on (chip held in reset), wait, RTS off (chip starts). esptool-js' own "hard_reset"
// only lets go of RTS without pulling it first, which leaves the chip sitting in the flasher.
const RESET_INTO_FIRMWARE = 'D0|R1|W200|R0|W200'

const phase = ref<InstallPhase>('idle')
const progress = ref(0)
const release = ref<FirmwareRelease>()
const error = ref<InstallError>()
const errorDetail = ref<string>()
const failedAt = ref<InstallPhase>()

const running = computed(() => !['idle', 'success', 'failed'].includes(phase.value))

// Closing the tab mid-write leaves a half-written flash (the ROM bootloader survives, so it
// can be installed again, but the device won't start until then)
function warnBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
}
watch(running, (isRunning) => {
  if (isRunning) window.addEventListener('beforeunload', warnBeforeUnload)
  else window.removeEventListener('beforeunload', warnBeforeUnload)
})

class InstallFailure extends Error {
  constructor(
    public code: InstallError,
    public detail?: string,
  ) {
    super(code)
  }
}

// Checked before the chip is touched
export async function verifyFullImage(
  image: Uint8Array<ArrayBuffer>,
  expected: { size: number; sha256: string },
) {
  if (image.length !== expected.size) throw new InstallFailure('size')
  if ((await sha256Hex(image)) !== expected.sha256.toLowerCase()) throw new InstallFailure('hash')
  // Starts with the bootloader: an ESP image (0xE9) built for the ESP32-S3
  if (image[0] !== 0xe9 || image[12] !== IMAGE_CHIP_ID_S3) throw new InstallFailure('notImage')
}

// esptool-js reports what it does; it goes to the debug log like the device's own lines
const terminal = {
  clean() {},
  write: (data: string) => recordLine('in', `[esptool] ${data}`),
  writeLine: (data: string) => recordLine('in', `[esptool] ${data}`),
}

async function flash(port: SerialPort, image: Uint8Array<ArrayBuffer>) {
  // Loaded only now: nobody needs the flasher for normal use
  const { ESPLoader, Transport } = await import('esptool-js')
  const transport = new Transport(port, false)
  try {
    const loader = new ESPLoader({ transport, baudrate: 921600, romBaudrate: 115200, terminal })

    phase.value = 'bootloader'
    try {
      await loader.main() // resets into download mode, detects the chip, loads the flasher stub
    } catch (e) {
      throw new InstallFailure('bootloader', String(e))
    }

    // Never write a board Clausage wasn't built for
    if (loader.chip.CHIP_NAME !== EXPECTED_CHIP) {
      throw new InstallFailure('wrongChip', loader.chip.CHIP_NAME)
    }
    const flashSize = await loader.detectFlashSize()
    if (flashSize !== EXPECTED_FLASH) throw new InstallFailure('wrongFlash', flashSize ?? '?')

    phase.value = 'write'
    progress.value = 0
    try {
      await loader.writeFlash({
        fileArray: [{ data: image, address: 0 }],
        flashMode: 'keep',
        flashFreq: 'keep',
        flashSize: 'keep', // the bootloader header already says 16 MB
        eraseAll: false, // the image carries empty settings, that erases them
        compress: true,
        reportProgress: (_, written, total) => (progress.value = written / total),
      })
      await loader.after('custom_reset', undefined, RESET_INTO_FIRMWARE)
    } catch (e) {
      throw new InstallFailure('write', String(e))
    }
  } finally {
    await transport.disconnect().catch(() => {})
  }
}

export function useFirmwareInstall() {
  const { beginInstall, endInstall, reconnect } = useSerial()
  const { info } = useDevice()
  const { installable, ensureLoaded } = useFirmware()

  ensureLoaded()

  async function start() {
    if (running.value) return

    error.value = undefined
    errorDetail.value = undefined
    failedAt.value = undefined
    progress.value = 0
    release.value = installable()

    let port: SerialPort | undefined
    try {
      const target = release.value
      if (!target?.install || !target.installUrl) throw new InstallFailure('noFirmware')

      phase.value = 'download'
      const image = await download(target.installUrl, target.install.size, (done) => {
        progress.value = done
      }).catch((e) => {
        throw new InstallFailure('download', String(e))
      })

      phase.value = 'verify'
      await verifyFullImage(image, target.install)

      // From here the port belongs to the installer
      port = await beginInstall()
      if (!port) throw new InstallFailure('noDevice')
      await flash(port, image)
      endInstall()
      port = undefined

      phase.value = 'restart'
      if (!(await reconnect(RESTART_TIMEOUT_MS))) throw new InstallFailure('notBack')

      phase.value = 'check'
      await until(info).toBeTruthy({ timeout: 5000 })
      if (info.value?.version !== target.version) {
        throw new InstallFailure('version', info.value?.version)
      }

      phase.value = 'success'
    } catch (e) {
      console.error('[install]', e)
      if (port) endInstall()
      const failure = e instanceof InstallFailure ? e : new InstallFailure('write', String(e))
      error.value = failure.code
      errorDetail.value = failure.detail
      failedAt.value = phase.value
      phase.value = 'failed'
    }
  }

  function reset() {
    if (running.value) return
    phase.value = 'idle'
  }

  return {
    phase: readonly(phase),
    progress: readonly(progress),
    release: readonly(release),
    error: readonly(error),
    errorDetail: readonly(errorDetail),
    failedAt: readonly(failedAt),
    running,
    start,
    reset,
  }
}
