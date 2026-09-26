// IANA name -> POSIX rule, from the posix_tz_db project (src/assets/timezones)
export type ZoneTable = Record<string, string>

let table: Promise<ZoneTable> | undefined

// Loaded on first use only, it is not needed on every page
export function loadZones() {
  table ??= import('@/assets/timezones/zones.json').then((m) => m.default as ZoneTable)
  return table
}

// Browsers sometimes report an old or a newer name than the table uses
const aliases: Record<string, string> = {
  UTC: 'Etc/UTC',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Kyiv': 'Europe/Kiev',
}

// The browser's zone as named in the table, or undefined if the table doesn't know it
export function browserZone(zones: ZoneTable) {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone
  const known = aliases[name] ?? name
  return known in zones ? known : undefined
}

// The device runs on UTC until the web app has set a zone
export function isUnset(name: string | undefined) {
  return !name || name === 'UTC' || name === 'Etc/UTC'
}
