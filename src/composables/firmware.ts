import { readonly, ref } from 'vue'

// Firmware releases live in a public repo; raw.githubusercontent.com allows fetch from any origin
const REPO_URL = 'https://raw.githubusercontent.com/Flo0806/clausage-firmware/main/'

// One entry in manifest.json. Per board either one entry or a list of them.
interface ManifestEntry {
  version: string
  file: string
  size: number
  sha256: string
  released: string // YYYY-MM-DD
}

interface Manifest {
  boards: Record<string, ManifestEntry | ManifestEntry[]>
}

export interface FirmwareRelease extends ManifestEntry {
  board: string
  url: string // absolute download URL of the .bin
}

// Loaded once for the whole app
const releases = ref<FirmwareRelease[]>([])
const loading = ref(false)
const loaded = ref(false)
const error = ref(false)

// "0.10.0" > "0.9.0": compare the numbers, not the text
function compareVersions(a: string, b: string) {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff) return diff
  }
  return 0
}

async function load() {
  loading.value = true
  error.value = false
  try {
    const response = await fetch(REPO_URL + 'manifest.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const manifest = (await response.json()) as Manifest

    releases.value = Object.entries(manifest.boards)
      .flatMap(([board, entries]) =>
        [entries].flat().map((entry) => ({ ...entry, board, url: REPO_URL + entry.file })),
      )
      .sort((a, b) => compareVersions(b.version, a.version) || b.released.localeCompare(a.released))
    loaded.value = true
  } catch (e) {
    console.error('[firmware] could not load the manifest', e)
    error.value = true
  } finally {
    loading.value = false
  }
}

export function useFirmware() {
  // Loads the manifest the first time it is needed
  function ensureLoaded() {
    if (!loaded.value && !loading.value) void load()
  }

  function findRelease(board: string, version: string) {
    return releases.value.find((r) => r.board === board && r.version === version)
  }

  return {
    releases: readonly(releases),
    loading: readonly(loading),
    error: readonly(error),
    ensureLoaded,
    reload: load,
    findRelease,
  }
}

export function formatSize(bytes: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'megabyte',
    maximumFractionDigits: 2,
  }).format(bytes / 1024 / 1024)
}

export function formatDate(isoDate: string, locale: string) {
  // Without a time "2026-09-26" is read as UTC midnight, which is the day before west of UTC
  const date = new Date(`${isoDate}T00:00:00`)
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}
