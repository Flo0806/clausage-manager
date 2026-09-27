<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="text-2xl font-bold mb-2 col-span-6">{{ $t('settings.device.title') }}</h2>

      <div class="col-span-6 flex flex-col gap-4">
        <DeviceStatus v-if="connected" :info="info" :wifi="wifi" :token="token" />

        <!-- A board answered nothing: new, another firmware, or a broken install -->
        <div
          v-else-if="blank"
          class="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 p-4"
        >
          <p class="flex items-center gap-2 font-semibold">
            <span class="i-lucide-package-plus inline-block text-primary" aria-hidden="true" />
            {{ $t('settings.device.blankTitle') }}
          </p>
          <p class="text-sm text-muted">{{ $t('settings.device.blankText') }}</p>
          <div class="flex flex-wrap gap-2 pt-1">
            <button
              class="btn-primary"
              :disabled="busy || installing || !installRelease"
              @click="confirmInstall = true"
            >
              {{
                installRelease
                  ? $t('settings.device.install', { version: installRelease.version })
                  : $t('settings.device.installLoading')
              }}
            </button>
            <button class="btn-secondary" :disabled="busy || installing" @click="change">
              {{ $t('settings.device.change') }}
            </button>
          </div>
        </div>

        <p v-else-if="paired" class="flex items-center gap-2 text-muted">
          <span class="i-lucide-unplug inline-block shrink-0" aria-hidden="true" />
          {{ $t('settings.device.pairedNotConnected') }}
        </p>

        <p v-else class="text-muted">{{ $t('settings.device.neverConnected') }}</p>

        <p v-if="restarting" role="status" class="flex items-center gap-2 text-sm text-primary">
          <span class="i-lucide-loader-circle inline-block animate-spin" aria-hidden="true" />
          {{ $t('settings.device.restarting') }}
        </p>

        <div v-if="!blank" class="flex flex-wrap gap-2">
          <template v-if="paired">
            <button v-if="connected" class="btn-primary" :disabled="busy" @click="wave">
              {{ $t('settings.device.hello') }}
            </button>
            <button
              v-if="connected"
              class="btn-secondary"
              :disabled="busy || restarting"
              @click="restart"
            >
              {{ $t('settings.device.reboot') }}
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

        <!-- Danger zone: can't be undone, so it asks in a dialog -->
        <div
          v-if="connected"
          class="mt-2 flex flex-col items-start gap-2 border-t border-border pt-4"
        >
          <h3 class="text-sm font-semibold text-danger">{{ $t('settings.device.dangerZone') }}</h3>
          <p class="text-sm text-muted">{{ $t('settings.device.factoryResetHint') }}</p>
          <button class="btn-danger" :disabled="busy || restarting" @click="confirmReset = true">
            {{ $t('settings.device.factoryReset') }}
          </button>
        </div>

        <ConfirmDialog
          v-model="confirmInstall"
          danger
          :title="$t('settings.device.installTitle')"
          :confirm-label="$t('settings.device.installConfirm')"
          @confirm="startInstall"
        >
          <p>{{ $t('settings.device.installText') }}</p>
        </ConfirmDialog>

        <ConfirmDialog
          v-model="confirmReset"
          danger
          :title="$t('settings.device.factoryResetTitle')"
          :confirm-label="$t('settings.device.factoryResetConfirm')"
          @confirm="factory"
        >
          <p class="mb-2">{{ $t('settings.device.factoryResetText') }}</p>
          <ul class="list-disc pl-5 text-muted">
            <li v-for="item in forgottenItems" :key="item">
              {{ $t(`settings.device.forgets.${item}`) }}
            </li>
          </ul>
        </ConfirmDialog>
      </div>
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSerial } from '@/composables/serial.ts'
import { useDevice } from '@/composables/device.ts'
import BaseCard from '../ui/BaseCard.vue'
import ConfirmDialog from '../ui/ConfirmDialog.vue'
import DeviceStatus from './DeviceStatus.vue'
import { useFirmware } from '@/composables/firmware.ts'
import { useFirmwareInstall } from '@/composables/firmwareInstall.ts'

const { t } = useI18n()
const { connected, paired, blank, connect, changeDevice, forgetDevice } = useSerial()
const { info, wifi, token, restarting, sayHello, reboot, factoryReset } = useDevice()

const confirmReset = ref(false)

// First install on a board without Clausage
const { installable } = useFirmware()
const { start: startInstall, running: installing } = useFirmwareInstall()
const installRelease = computed(() => installable())
const confirmInstall = ref(false)
const forgottenItems = ['wifi', 'token', 'timezone', 'settings', 'stats'] as const

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
    if ((await connect()) === false && !blank.value) error.value = t('settings.device.errorConnect')
  })

const change = () =>
  run(async () => {
    if ((await changeDevice()) === false && !blank.value) {
      error.value = t('settings.device.errorConnect')
    }
  })

const forget = () => run(forgetDevice)

const wave = () =>
  run(async () => {
    const reply = await sayHello()
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = t('settings.device.errorDevice')
  })

const restart = () =>
  run(async () => {
    const reply = await reboot()
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = t('settings.device.errorDevice')
  })

const factory = () =>
  run(async () => {
    const reply = await factoryReset()
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = t('settings.device.errorDevice')
  })
</script>
