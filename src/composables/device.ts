import { readonly, ref, watch } from 'vue'
import { useSerial, type DeviceMessage } from './serial.ts'
import { browserZone, isUnset, loadZones } from './timezones.ts'

// Commands of the Clausage device, see "Serial commands" in the firmware README

export type WifiState = 'not_configured' | 'connecting' | 'connected' | 'failed' | 'disconnected'
export type WifiFailReason = 'wrong_password' | 'not_found' | 'timeout'

export interface WifiStatus {
  state: WifiState
  ssid: string
  reason?: WifiFailReason // only when state is 'failed'
  rssi?: number // signal in dBm, only while connected (-50 good, -90 very weak)
}

export interface WifiReply {
  id: number
  ok: boolean
  wifi?: WifiStatus
  error?: 'invalid_ssid' | 'invalid_password' | (string & {})
}

export type TokenState = 'not_configured' | 'unchecked' | 'valid' | 'invalid'

// The device never sends the token itself, only its status
export interface TokenStatus {
  configured: boolean
  state: TokenState
  problem?: 'unreachable' | 'server_error' | 'no_usage'
}

export interface DeviceInfo {
  device: string
  version: string
  board: string
}

export interface TokenReply {
  id: number
  ok: boolean
  token?: TokenStatus
  error?: 'invalid_token' | 'storage_failed' | (string & {})
}

// name: for people (IANA, e.g. "Europe/Berlin"); rule: POSIX rule the device calculates with
export interface TimezoneStatus {
  name: string
  rule: string
}

export interface TimezoneReply {
  id: number
  ok: boolean
  timezone?: TimezoneStatus
  error?: 'invalid_timezone' | 'storage_failed' | (string & {})
}

// active: asks Claude every 2 minutes; saving: every 30 minutes, display off
export type DeviceMode = 'active' | 'saving'

export interface UsageWindow {
  percent: number
  resets_at: number // Unix time in seconds
}

// Only known once Claude has answered once
export interface Usage {
  fetched_at: number // when Claude gave these numbers (Unix time, seconds); 0 = unknown
  five_hour: UsageWindow
  seven_day: UsageWindow
}

// A request to Claude is running; `word` is what the display shows ("Clauding", "Pondering", ...)
export interface Fetching {
  active: boolean
  word?: string
}

interface InfoReply extends DeviceInfo {
  id: number
  ok: boolean
  wifi?: WifiStatus
  token?: TokenStatus
  timezone?: TimezoneStatus
  mode?: DeviceMode
  usage?: Usage
}

interface HelloReply extends DeviceInfo {
  id: number
  ok: boolean
  error?: string
}

// Device state for the whole app, kept in one place:
// filled by "info" after connecting, then updated by replies and events
const { connected, request, addListener } = useSerial()
const info = ref<DeviceInfo>()
const wifi = ref<WifiStatus>()
const token = ref<TokenStatus>()
const timezone = ref<TimezoneStatus>()
const mode = ref<DeviceMode>()
const usage = ref<Usage>()
const fetching = ref<Fetching>({ active: false })

// immediate: also covers a connection made before this module was first imported
watch(
  connected,
  async (isConnected) => {
    if (!isConnected) {
      info.value = undefined
      wifi.value = undefined
      token.value = undefined
      timezone.value = undefined
      mode.value = undefined
      usage.value = undefined
      fetching.value = { active: false }
      return
    }
    // Events only come on changes, so ask once for the current state
    const reply = await request<InfoReply>('info')
    if (!reply?.ok) return
    info.value = { device: reply.device, version: reply.version, board: reply.board }
    wifi.value = reply.wifi
    token.value = reply.token
    timezone.value = reply.timezone
    if (reply.timezone && isUnset(reply.timezone.name)) void setBrowserTimezone()
    mode.value = reply.mode
    if (reply.usage) {
      const { fetched_at, five_hour, seven_day } = reply.usage
      usage.value = { fetched_at, five_hour, seven_day }
    }
  },
  { immediate: true },
)

addListener('wifi', (message: DeviceMessage) => {
  const { state, ssid, reason, rssi } = message as unknown as WifiStatus
  wifi.value = { state, ssid, reason, rssi }
})

addListener('token', (message: DeviceMessage) => {
  const { configured, state, problem } = message as unknown as TokenStatus
  token.value = { configured, state, problem }
})

addListener('usage', (message: DeviceMessage) => {
  const {
    fetched_at,
    five_hour,
    seven_day,
    mode: usageMode,
  } = message as unknown as Usage & { mode?: DeviceMode }
  usage.value = { fetched_at, five_hour, seven_day }
  if (usageMode) mode.value = usageMode
})

addListener('fetching', (message: DeviceMessage) => {
  const { active, word } = message as unknown as Fetching
  fetching.value = { active, word }
})

addListener('mode', (message: DeviceMessage) => {
  mode.value = (message as unknown as { mode: DeviceMode }).mode
})

// The device still runs on UTC: give it the browser's zone. A zone already set is never replaced,
// the user may have chosen it on purpose.
async function setBrowserTimezone() {
  const zones = await loadZones()
  const name = browserZone(zones)
  const rule = name && zones[name]
  if (name && rule) await sendTimezone(name, rule)
}

async function sendTimezone(name: string, rule: string) {
  const reply = await request<TimezoneReply>('timezone.set', { name, rule })
  if (reply?.ok && reply.timezone) timezone.value = reply.timezone
  return reply
}

export function useDevice() {
  // Shows "Hello Clausage!" on the display for 2 seconds, to see which device is connected
  function sayHello() {
    return request<HelloReply>('hello')
  }

  // The reply only says "connecting"; the result follows as "wifi" event
  async function setWifi(ssid: string, password: string) {
    const reply = await request<WifiReply>('wifi.set', { ssid, password })
    if (reply?.ok && reply.wifi) wifi.value = reply.wifi
    return reply
  }

  async function clearWifi() {
    const reply = await request<WifiReply>('wifi.clear')
    if (reply?.ok && reply.wifi) wifi.value = reply.wifi
    return reply
  }

  // The reply only says "unchecked"; the result of the check follows as "token" event
  // (only once Wi-Fi is up)
  async function setToken(value: string) {
    const reply = await request<TokenReply>('token.set', { token: value })
    if (reply?.ok && reply.token) token.value = reply.token
    return reply
  }

  async function clearToken() {
    const reply = await request<TokenReply>('token.clear')
    if (reply?.ok && reply.token) token.value = reply.token
    return reply
  }

  // The device gets UTC from NTP; this tells it the local time zone (there is no event for it)
  const setTimezone = sendTimezone

  return {
    info: readonly(info),
    wifi: readonly(wifi),
    token: readonly(token),
    timezone: readonly(timezone),
    mode: readonly(mode),
    usage: readonly(usage),
    fetching: readonly(fetching),
    sayHello,
    setWifi,
    clearWifi,
    setToken,
    clearToken,
    setTimezone,
  }
}
