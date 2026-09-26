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

interface InfoReply {
  id: number
  ok: boolean
  wifi?: WifiStatus
}

// Device state for the whole app, kept in one place:
// filled by "info" after connecting, then updated by replies and events
const { connected, request, addListener } = useSerial()
const wifi = ref<WifiStatus>()

// immediate: also covers a connection made before this module was first imported
watch(
  connected,
  async (isConnected) => {
    if (!isConnected) {
      wifi.value = undefined
      return
    }
    // Events only come on changes, so ask once for the current state
    const reply = await request<InfoReply>('info')
    if (reply?.ok) wifi.value = reply.wifi
  },
  { immediate: true },
)

addListener('wifi', (message: DeviceMessage) => {
  const { state, ssid, reason } = message as unknown as WifiStatus
  wifi.value = { state, ssid, reason }
})

export function useDevice() {
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

  return { wifi: readonly(wifi), setWifi, clearWifi }
}
