<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="col-span-6 mb-2 text-2xl font-bold">{{ $t('settings.stats.title') }}</h2>

      <p v-if="!stats" class="col-span-6 flex items-center gap-2 text-muted">
        <span class="i-lucide-unplug inline-block shrink-0" aria-hidden="true" />
        {{ $t('settings.stats.noDevice') }}
      </p>

      <div v-else class="col-span-6 flex flex-col gap-4">
        <p class="text-sm text-muted">{{ $t('settings.stats.intro') }}</p>

        <dl class="grid grid-cols-2 gap-3">
          <div class="rounded-lg bg-fg/5 p-3">
            <dt class="text-sm text-muted">{{ $t('settings.stats.requests') }}</dt>
            <dd class="font-mono text-2xl font-semibold tabular-nums">
              {{ stats.requests.toLocaleString(locale) }}
            </dd>
          </div>
          <div class="rounded-lg bg-fg/5 p-3">
            <dt class="text-sm text-muted">{{ $t('settings.stats.tokens') }}</dt>
            <dd class="font-mono text-2xl font-semibold tabular-nums">
              {{ stats.tokens.toLocaleString(locale) }}
            </dd>
          </div>
        </dl>

        <p class="text-sm text-muted">{{ sinceText }}</p>

        <!-- Inline confirmation instead of a dialog: resetting can't be undone, but is harmless -->
        <div v-if="!confirming">
          <button class="btn-secondary" :disabled="busy" @click="confirming = true">
            {{ $t('settings.stats.reset') }}
          </button>
        </div>
        <div v-else class="flex flex-wrap items-center gap-2">
          <span class="text-sm">{{ $t('settings.stats.confirm') }}</span>
          <button class="btn-primary" :disabled="busy" @click="reset">
            {{ $t('settings.stats.confirmYes') }}
          </button>
          <button class="btn-ghost" :disabled="busy" @click="confirming = false">
            {{ $t('settings.stats.confirmNo') }}
          </button>
        </div>

        <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
      </div>
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '../ui/BaseCard.vue'
import { useDevice } from '@/composables/device.ts'

const { t, locale } = useI18n()
const { stats, resetStats } = useDevice()

const sinceText = computed(() => {
  if (!stats.value?.since) return t('settings.stats.sinceUnknown')
  const date = new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(stats.value.since * 1000)
  return t('settings.stats.since', { date })
})

const confirming = ref(false)
const busy = ref(false)
const error = ref<string>()

async function reset() {
  busy.value = true
  error.value = undefined
  try {
    const reply = await resetStats()
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = t('settings.device.errorDevice')
    else confirming.value = false
  } finally {
    busy.value = false
  }
}
</script>
