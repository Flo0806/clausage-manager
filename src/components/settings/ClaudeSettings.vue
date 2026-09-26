<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <div class="col-span-6 mb-2 flex items-center justify-between">
        <h2 class="text-2xl font-bold">{{ $t('settings.claude.title') }}</h2>
        <span
          role="img"
          :aria-label="statusText"
          :title="statusText"
          :class="statusIcon"
          class="i-simple-icons-claude inline-block text-2xl"
        />
      </div>

      <div class="col-span-6">
        <FormGroup
          v-slot="field"
          :label="$t('settings.claude.label')"
          :error="noCodeError"
          required
        >
          <BaseInput
            v-bind="field"
            v-model="tokenInput"
            :placeholder="$t('settings.claude.placeholder')"
            @blur="blured = true"
          />
        </FormGroup>

        <p v-if="connected && !wifiUp" class="mt-2 flex items-center gap-2 text-sm text-muted">
          <span class="i-lucide-wifi-off inline-block shrink-0" aria-hidden="true" />
          {{ $t('settings.claude.needsWifi') }}
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <button class="btn-primary" :disabled="busy || !tokenInput.trim()" @click="save">
            {{ $t('settings.claude.save') }}
          </button>
          <button class="btn-secondary" :disabled="busy" @click="clear">
            {{ $t('settings.claude.clear') }}
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
import { useDevice, type TokenReply, type TokenState } from '@/composables/device.ts'

const { t, te } = useI18n()
const { connect, connected } = useSerial()
const { token, wifi, setToken, clearToken } = useDevice()

const tokenInput = ref('')
const blured = ref(false)

const noCodeError = computed(() =>
  blured.value && !tokenInput.value.trim() ? t('settings.claude.error') : undefined,
)

const code = computed(() => (tokenInput.value ? 'CLAUDE:' + tokenInput.value : undefined))

// The device can only check the token with Wi-Fi
const wifiUp = computed(() => wifi.value?.state === 'connected')

// Colors only: the icon class itself is static in the template, so UnoCSS finds it
const colors: Record<TokenState | 'unknown', string> = {
  unknown: 'text-muted',
  not_configured: 'text-muted',
  unchecked: 'text-primary animate-pulse',
  valid: 'text-primary',
  invalid: 'text-danger',
}

const statusIcon = computed(() => {
  const state = token.value?.state ?? 'unknown'
  // Without Wi-Fi "unchecked" is not in progress, it just waits
  if (state === 'unchecked' && !wifiUp.value) return 'text-muted'
  return colors[state]
})

const statusText = computed(() => {
  const status = token.value
  if (!status) return t('settings.claude.status.unknown')
  const text = t(`settings.claude.status.${status.state}`)
  return status.problem ? `${text} (${t(`settings.claude.problem.${status.problem}`)})` : text
})

// Unknown error codes (e.g. "unknown_command") fall back to a generic text
function errorText(code?: string) {
  const key = `settings.claude.errors.${code}`
  return te(key) ? t(key) : t('settings.claude.errors.unknown')
}

const busy = ref(false)
const error = ref<string>()

// Auto-connect happens without a click, so an old connection error must go away by itself
watch(connected, (isConnected) => {
  if (isConnected) error.value = undefined
})

async function run(command: () => Promise<TokenReply | undefined>) {
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

const save = () => run(() => setToken(tokenInput.value.trim()))
const clear = () => run(() => clearToken())
</script>
