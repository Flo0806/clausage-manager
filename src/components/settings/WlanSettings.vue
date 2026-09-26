<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <div class="col-span-6 mb-2 flex items-center justify-between">
        <h2 class="text-2xl font-bold">{{ $t('settings.wlan.title') }}</h2>
        <span
          role="img"
          :aria-label="statusText"
          :title="statusText"
          :class="statusIcon"
          class="inline-block text-2xl"
        />
      </div>

      <div class="col-span-6">
        <FormGroup
          v-slot="field"
          :label="$t('settings.wlan.ssidLabel')"
          :error="ssidError"
          required
        >
          <BaseInput
            v-bind="field"
            v-model="ssid"
            :placeholder="$t('settings.wlan.ssidPlaceholder')"
            @blur="ssidBlured = true"
          />
        </FormGroup>

        <FormGroup
          class="mt-4"
          v-slot="field"
          :label="$t('settings.wlan.passwordLabel')"
          :error="passwordError"
          required
        >
          <BaseInput
            v-bind="field"
            v-model="password"
            :placeholder="$t('settings.wlan.passwordPlaceholder')"
            @blur="passwordBlured = true"
          />
        </FormGroup>

        <div class="mt-4 flex flex-wrap gap-2">
          <button class="btn-primary" :disabled="busy || !ssid.trim()" @click="save">
            {{ $t('settings.wlan.save') }}
          </button>
          <button class="btn-secondary" :disabled="busy" @click="clear">
            {{ $t('settings.wlan.clear') }}
          </button>
        </div>

        <p v-if="error" role="alert" class="mt-2 text-sm text-danger">{{ error }}</p>
      </div>

      <QrcodeVue
        class="mt-5 col-span-6 w-full h-auto"
        v-if="code"
        :value="code"
        level="H"
        render-as="svg"
      />
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import QrcodeVue from 'qrcode.vue'
import BaseInput from '../ui/BaseInput.vue'
import FormGroup from '../ui/FormGroup.vue'

import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '../ui/BaseCard.vue'
import { useSerial } from '@/composables/serial.ts'
import { useDevice, type WifiReply, type WifiState } from '@/composables/device.ts'

const { t, te } = useI18n()
const { connect, connected } = useSerial()
const { wifi, setWifi, clearWifi } = useDevice()

// Full class names, so UnoCSS can find them
const icons: Record<WifiState | 'unknown', string> = {
  unknown: 'i-lucide-wifi text-muted',
  not_configured: 'i-lucide-wifi-off text-muted',
  connecting: 'i-lucide-wifi text-primary animate-pulse',
  connected: 'i-lucide-wifi text-primary',
  failed: 'i-lucide-wifi-off text-danger',
  disconnected: 'i-lucide-wifi-off text-danger',
}

const statusIcon = computed(() => icons[wifi.value?.state ?? 'unknown'])

const statusText = computed(() => {
  const status = wifi.value
  if (!status) return t('settings.wlan.status.unknown')
  const text = t(`settings.wlan.status.${status.state}`, { ssid: status.ssid })
  return status.reason ? `${text} (${t(`settings.wlan.reason.${status.reason}`)})` : text
})

// Unknown error codes (e.g. "unknown_command") fall back to a generic text
function errorText(code?: string) {
  const key = `settings.wlan.error.${code}`
  return te(key) ? t(key) : t('settings.wlan.error.unknown')
}

const busy = ref(false)
const error = ref<string>()

// Auto-connect happens without a click, so an old connection error must go away by itself
watch(connected, (isConnected) => {
  if (isConnected) error.value = undefined
})

async function run(command: () => Promise<WifiReply | undefined>) {
  busy.value = true
  error.value = undefined
  try {
    await connect()
    if (!connected.value) {
      error.value = t('settings.device.errorConnect')
      return
    }
    const reply = await command()
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = errorText(reply.error)
  } finally {
    busy.value = false
  }
}

const save = () => run(() => setWifi(ssid.value.trim(), password.value))
const clear = () => run(() => clearWifi())

const ssid = ref('')
const password = ref('')
const ssidBlured = ref(false)
const passwordBlured = ref(false)

const ssidError = computed(() =>
  ssidBlured.value && !ssid.value.trim() ? t('settings.wlan.ssidError') : undefined,
)

const passwordError = computed(() =>
  passwordBlured.value && !password.value.trim() ? t('settings.wlan.passwordError') : undefined,
)

const code = computed(() => {
  if (ssid.value && password.value) {
    return `WIFI:S:${ssid.value};T:WPA;P:${password.value};;`
  }
  return undefined
})
</script>
