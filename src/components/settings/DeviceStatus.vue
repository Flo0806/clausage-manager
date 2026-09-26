<template>
  <div role="status" class="flex flex-col gap-3">
    <p class="flex items-center gap-2 font-semibold">
      <span class="i-lucide-circle-check inline-block text-primary" aria-hidden="true" />
      {{ $t('settings.device.connected') }}
    </p>

    <dl v-if="info" class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted">{{ $t('settings.device.device') }}</dt>
      <dd class="font-mono">{{ info.device }}</dd>
      <dt class="text-muted">{{ $t('settings.device.version') }}</dt>
      <dd class="font-mono">{{ info.version }}</dd>
      <dt class="text-muted">{{ $t('settings.device.board') }}</dt>
      <dd class="font-mono">{{ info.board }}</dd>
    </dl>

    <ul class="flex flex-col gap-2 text-sm">
      <li class="flex items-center gap-2">
        <span
          :class="wifiConnected ? 'i-lucide-wifi text-primary' : 'i-lucide-wifi-off text-muted'"
          class="inline-block text-lg"
          aria-hidden="true"
        />
        <span v-if="wifiConnected">
          {{ $t('settings.device.wifiConnected') }}
          <span class="font-mono">{{ wifi?.ssid }}</span>
        </span>
        <span v-else class="text-muted">{{ $t('settings.device.wifiNotConnected') }}</span>
      </li>
      <li class="flex items-center gap-2">
        <span
          :class="tokenConfigured ? 'text-primary' : 'text-muted'"
          class="i-simple-icons-claude inline-block text-lg"
          aria-hidden="true"
        />
        <span :class="{ 'text-muted': !tokenConfigured }">
          {{
            tokenConfigured
              ? $t('settings.device.tokenConfigured')
              : $t('settings.device.tokenNotConfigured')
          }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { DeviceInfo, TokenStatus, WifiStatus } from '@/composables/device.ts'

const props = defineProps<{
  info?: DeviceInfo
  wifi?: WifiStatus
  token?: TokenStatus
}>()

const wifiConnected = computed(() => props.wifi?.state === 'connected')
const tokenConfigured = computed(() => props.token?.configured === true)
</script>
