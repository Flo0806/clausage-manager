<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="text-2xl font-bold mb-2 col-span-6">{{ $t('settings.device.title') }}</h2>

      <div class="col-span-6 flex flex-col gap-4">
        <DeviceStatus v-if="connected" :info="info" :wifi="wifi" :token="token" />

        <p v-else-if="paired" class="flex items-center gap-2 text-muted">
          <span class="i-lucide-unplug inline-block shrink-0" aria-hidden="true" />
          {{ $t('settings.device.pairedNotConnected') }}
        </p>

        <p v-else class="text-muted">{{ $t('settings.device.neverConnected') }}</p>

        <div class="flex flex-wrap gap-2">
          <template v-if="paired">
            <button v-if="connected" class="btn-primary" :disabled="busy" @click="wave">
              {{ $t('settings.device.hello') }}
            </button>
            <button class="btn-secondary" :disabled="busy" @click="change">
              {{ $t('settings.device.change') }}
            </button>
            <button class="btn-ghost" :disabled="busy" @click="forget">
              {{ $t('settings.device.forget') }}
            </button>
          </template>
          <button v-else class="btn-primary" :disabled="busy" @click="pair">
            {{ $t('settings.device.connect') }}
          </button>
        </div>

        <div
          v-if="error"
          role="alert"
          class="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-danger"
        >
          <span class="i-lucide-circle-alert mt-0.5 inline-block shrink-0" aria-hidden="true" />
          <span>{{ error }}</span>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSerial } from '@/composables/serial.ts'
import { useDevice } from '@/composables/device.ts'
import BaseCard from '../ui/BaseCard.vue'
import DeviceStatus from './DeviceStatus.vue'

const { t } = useI18n()
const { connected, paired, connect, changeDevice, forgetDevice } = useSerial()
const { info, wifi, token, sayHello } = useDevice()

const busy = ref(false)
const error = ref<string>()

// Auto-connect happens without a click, so an old connection error must go away by itself
watch(connected, (isConnected) => {
  if (isConnected) error.value = undefined
})

async function run(action: () => Promise<void>) {
  busy.value = true
  error.value = undefined
  try {
    await action()
  } finally {
    busy.value = false
  }
}

// false: port busy or the picked device did not answer (undefined: dialog closed, no error)
const pair = () =>
  run(async () => {
    if ((await connect()) === false) error.value = t('settings.device.errorConnect')
  })

const change = () =>
  run(async () => {
    if ((await changeDevice()) === false) error.value = t('settings.device.errorConnect')
  })

const forget = () => run(forgetDevice)

const wave = () =>
  run(async () => {
    const reply = await sayHello()
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = t('settings.device.errorDevice')
  })
</script>
