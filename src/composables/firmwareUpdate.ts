import { computed, readonly, ref, watch } from 'vue'
import { until } from '@vueuse/core'
import { DeviceError, useSerial } from './serial.ts'
import { useDevice } from './device.ts'
import type { FirmwareRelease } from './firmware.ts'

export type UpdatePhase =
  | 'idle'
  | 'download'
  | 'verify'
  | 'erase'
  | 'write'
  | 'restart'
  | 'check'
  | 'success'
  | 'failed'

// Keys under "updateRun.error" in the locale files
export type UpdateError =
  | 'notConnected'
  | 'wrongBoard'
  | 'download'
  | 'size'
  | 'hash'
  | 'notFirmware'
  | 'version'
  | 'device'
  | 'timeout'
  | 'notBack'
  | 'rollback'

const RESTART_TIMEOUT_MS = 20000

// One update at a time for the whole app, so the dialog can live in App.vue
const phase = ref<UpdatePhase>('idle')
const progress = ref(0) // 0..1 within download and write
const release = ref<FirmwareRelease>()
const fromVersion = ref<string>()
const error = ref<UpdateError>()
const errorDetail = ref<string>() // e.g. the device's reason after "ERR"
const failedAt = ref<UpdatePhase>() // the step that went wrong

const running = computed(() => !['idle', 'success', 'failed'].includes(phase.value))

// Closing or reloading the tab mid-update would cut the transfer
function warnBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault()
}
watch(running, (isRunning) => {
  if (isRunning) window.addEventListener('beforeunload', warnBeforeUnload)
  else window.removeEventListener('beforeunload', warnBeforeUnload)
})

export class UpdateFailure extends Error {
  constructor(
    public code: UpdateError,
    public detail?: string,
  ) {
    super(code)
  }
}

// Also used by the installer; onProgress gets 0..1
export async function download(
  url: string,
  expectedSize: number,
  onProgress: (done: number) => void,
) {
  const response = await fetch(url, { cache: 'no-cache' })
  if (!response.ok || !response.body) throw new UpdateFailure('download', `HTTP ${response.status}`)

  // Read in pieces to show the progress
  const reader = response.body.getReader()
  const parts: Uint8Array[] = []
  let received = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    parts.push(value)
    received += value.length
    onProgress(Math.min(received / expectedSize, 1))
  }

  const image = new Uint8Array(received)
  let offset = 0
  for (const part of parts) {
    image.set(part, offset)
    offset += part.length
  }
  return image
}

export async function sha256Hex(data: Uint8Array<ArrayBuffer>) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Everything is checked before a single byte goes to the device
export async function verify(image: Uint8Array<ArrayBuffer>, expected: FirmwareRelease) {
  if (image.length !== expected.size) throw new UpdateFailure('size')

  const hash = await sha256Hex(image)
  if (hash !== expected.sha256.toLowerCase()) throw new UpdateFailure('hash')

  // ESP image: first byte 0xE9; esp_app_desc_t at byte 32 starts with 0xABCD5432 (little endian)
  const view = new DataView(image.buffer, image.byteOffset, image.byteLength)
  if (image[0] !== 0xe9 || view.getUint32(32, true) !== 0xabcd5432) {
    throw new UpdateFailure('notFirmware')
  }

  // Version: 32-byte text at byte 48, ends at the first 0
  const versionBytes = image.subarray(48, 80)
  const end = versionBytes.indexOf(0)
  const version = new TextDecoder().decode(versionBytes.subarray(0, end < 0 ? undefined : end))
  if (version !== expected.version) throw new UpdateFailure('version', version)
}

export function useFirmwareUpdate() {
  const { connected, flashFirmware, reconnect } = useSerial()
  const { info } = useDevice()

  async function start(target: FirmwareRelease) {
    if (running.value) return

    release.value = target
    fromVersion.value = info.value?.version
    error.value = undefined
    errorDetail.value = undefined
    failedAt.value = undefined
    progress.value = 0

    try {
      if (!connected.value || !info.value) throw new UpdateFailure('notConnected')
      // A firmware for another board is blocked: at best it does not run, at worst it harms
      if (info.value.board !== target.board) throw new UpdateFailure('wrongBoard')

      phase.value = 'download'
      const image = await download(
        target.url,
        target.size,
        (done) => (progress.value = done),
      ).catch((e) => {
        throw e instanceof UpdateFailure ? e : new UpdateFailure('download', String(e))
      })

      phase.value = 'verify'
      await verify(image, target)

      phase.value = 'erase'
      progress.value = 0
      await flashFirmware(image, {
        onErased: () => (phase.value = 'write'),
        onProgress: (done) => (progress.value = done),
      })

      phase.value = 'restart'
      if (!(await reconnect(RESTART_TIMEOUT_MS))) throw new UpdateFailure('notBack')

      // device.ts asks "info" after connecting; wait for its answer
      phase.value = 'check'
      await until(info).toBeTruthy({ timeout: 5000 })
      if (info.value?.version !== target.version) {
        // The new firmware did not start, the device rolled back to the old one
        throw new UpdateFailure('rollback', info.value?.version)
      }

      phase.value = 'success'
    } catch (e) {
      console.error('[update]', e)
      if (e instanceof UpdateFailure) {
        error.value = e.code
        errorDetail.value = e.detail
      } else if (e instanceof DeviceError) {
        error.value = 'device'
        errorDetail.value = e.reason
      } else {
        error.value = 'timeout'
        errorDetail.value = e instanceof Error ? e.message : String(e)
      }
      failedAt.value = phase.value
      phase.value = 'failed'
    }
  }

  // Closes the dialog after success or failure
  function reset() {
    if (running.value) return
    phase.value = 'idle'
  }

  return {
    phase: readonly(phase),
    progress: readonly(progress),
    release: readonly(release),
    fromVersion: readonly(fromVersion),
    error: readonly(error),
    errorDetail: readonly(errorDetail),
    failedAt: readonly(failedAt),
    running,
    start,
    reset,
  }
}
