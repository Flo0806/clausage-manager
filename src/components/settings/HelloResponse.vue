<template>
  <div
    v-if="error"
    role="alert"
    class="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-danger"
  >
    <span class="i-lucide-circle-alert mt-0.5 inline-block shrink-0" aria-hidden="true" />
    <span>{{ error }}</span>
  </div>

  <div v-else-if="response" role="status" class="flex flex-col gap-3">
    <p class="flex items-center gap-2 font-semibold">
      <span class="i-lucide-circle-check inline-block text-primary" aria-hidden="true" />
      {{ $t('settings.hello.connected') }}
    </p>

    <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      <dt class="text-muted">{{ $t('settings.hello.device') }}</dt>
      <dd class="font-mono">{{ response.device }}</dd>
      <dt class="text-muted">{{ $t('settings.hello.version') }}</dt>
      <dd class="font-mono">{{ response.version }}</dd>
      <dt class="text-muted">{{ $t('settings.hello.board') }}</dt>
      <dd class="font-mono">{{ response.board }}</dd>
    </dl>

    <ul class="flex flex-col gap-2 text-sm">
      <li class="flex items-center gap-2">
        <span
          :class="wifiConnected ? 'i-lucide-wifi text-primary' : 'i-lucide-wifi-off text-muted'"
          class="inline-block text-lg"
          aria-hidden="true"
        />
        <span v-if="wifiConnected">
          {{ $t('settings.hello.wifiConnected') }}
          <span class="font-mono">{{ response.wifi?.ssid }}</span>
        </span>
        <span v-else class="text-muted">{{ $t('settings.hello.wifiNotConnected') }}</span>
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
              ? $t('settings.hello.tokenConfigured')
              : $t('settings.hello.tokenNotConfigured')
          }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'

// Reply to the "info" command. The device never sends the token itself, only whether one is set.
export interface HelloReply {
  id: number
  ok: boolean
  device: string
  version: string
  board: string
  wifi?: { state: string; ssid?: string }
  token?: { configured: boolean }
}

const props = defineProps<{
  response?: HelloReply
  error?: string
}>()

const wifiConnected = computed(() => props.response?.wifi?.state === 'connected')
const tokenConfigured = computed(() => props.response?.token?.configured === true)
</script>
