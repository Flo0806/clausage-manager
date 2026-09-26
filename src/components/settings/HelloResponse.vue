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
  </div>
</template>

<script lang="ts" setup>
export interface HelloReply {
  id: number
  ok: boolean
  device: string
  version: string
  board: string
}

defineProps<{
  response?: HelloReply
  error?: string
}>()
</script>
