import { readonly, ref, watch } from 'vue'
import { useSerial, type DeviceMessage } from './serial.ts'

// Commands of the Clausage device, see "Serial commands" in the firmware README

export type WifiState = 'not_configured' | 'connecting' | 'connected' | 'failed' | 'disconnected'
export type WifiFailReason = 'wrong_password' | 'not_found' | 'timeout'

export interface WifiStatus {
  state: WifiState
  ssid: string
  reason?: WifiFailReason // only when state is 'failed'
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

interface InfoReply extends DeviceInfo {
  id: number
  ok: boolean
  wifi?: WifiStatus
  token?: TokenStatus
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

// immediate: also covers a connection made before this module was first imported
watch(
  connected,
  async (isConnected) => {
    if (!isConnected) {
      info.value = undefined
      wifi.value = undefined
      token.value = undefined
      return
    }
    // Events only come on changes, so ask once for the current state
    const reply = await request<InfoReply>('info')
    if (!reply?.ok) return
    info.value = { device: reply.device, version: reply.version, board: reply.board }
    wifi.value = reply.wifi
    token.value = reply.token
  },
  { immediate: true },
)

addListener('wifi', (message: DeviceMessage) => {
  const { state, ssid, reason } = message as unknown as WifiStatus
  wifi.value = { state, ssid, reason }
})

addListener('token', (message: DeviceMessage) => {
  const { configured, state, problem } = message as unknown as TokenStatus
  token.value = { configured, state, problem }
})

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

  return {
    info: readonly(info),
    wifi: readonly(wifi),
    token: readonly(token),
    sayHello,
    setWifi,
    clearWifi,
  }
}
