<template>
  <BaseCard :class="{ 'opacity-60': stale }">
    <div class="flex items-center justify-between gap-4">
      <h2 class="text-2xl font-bold">{{ $t('usage.title') }}</h2>

      <!-- Like the display: while the device asks Claude the star spins and a word shows -->
      <span
        v-if="fetching.active"
        role="status"
        class="flex items-center gap-2 text-sm text-primary"
      >
        <span class="i-simple-icons-claude inline-block animate-spin" aria-hidden="true" />
        {{ fetching.word }}…
      </span>
      <span
        v-else-if="mode"
        class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
        :class="modeBadge[mode]"
        :title="$t(`usage.modeHint.${mode}`)"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
        {{ $t(`usage.mode.${mode}`) }}
      </span>
    </div>

    <template v-if="connected && usage">
      <p v-if="problem" class="flex items-center gap-2 text-sm text-muted">
        <span class="i-lucide-info inline-block shrink-0" aria-hidden="true" />
        {{ problem }}
      </p>

      <UsageBar
        :label="$t('usage.fiveHour')"
        :window="usage.five_hour"
        kind="five_hour"
        :now="now"
      />
      <UsageBar
        :label="$t('usage.sevenDay')"
        :window="usage.seven_day"
        kind="seven_day"
        :now="now"
      />

      <p v-if="updatedText" class="self-end text-xs text-muted" :title="$t('usage.accuracy')">
        {{ updatedText }}<template v-if="stale"> · {{ $t('usage.stale') }}</template>
      </p>
    </template>

    <!-- Instead of the bars, one clear line when something is missing (same as the display) -->
    <p v-else class="flex flex-wrap items-center gap-2 text-muted">
      <span
        v-if="missing === 'loading'"
        class="i-lucide-loader-circle inline-block animate-spin"
        aria-hidden="true"
      />
      {{ $t(`usage.missing.${missing}`) }}
      <RouterLink
        v-if="missing !== 'loading' && missing !== 'waitingWifi'"
        to="/settings"
        class="text-primary hover:underline"
      >
        {{ $t('usage.toSettings') }}
      </RouterLink>
    </p>
  </BaseCard>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '../ui/BaseCard.vue'
import UsageBar from './UsageBar.vue'
import { useSerial } from '@/composables/serial.ts'
import { useDevice } from '@/composables/device.ts'

const { t, locale } = useI18n()
const { connected } = useSerial()
const { wifi, token, usage, mode, fetching } = useDevice()

// Active is "all good" (olive like the display), saving means the display is off (gray)
const modeBadge = {
  active: 'bg-success/15 text-success',
  saving: 'bg-fg/10 text-muted',
} as const

// Ticks for countdowns and "updated 2 min ago"
const now = ref(Date.now())
const timer = setInterval(() => (now.value = Date.now()), 15000)
onUnmounted(() => clearInterval(timer))

// Same order as the display
const missing = computed(() => {
  if (!connected.value) return 'noDevice'
  if (wifi.value?.state === 'not_configured') return 'setupWifi'
  if (!token.value?.configured) return 'connectClaude'
  if (token.value.state === 'invalid') return 'tokenInvalid'
  if (wifi.value?.state !== 'connected') return 'waitingWifi'
  return 'loading'
})

// Numbers stay on screen when Wi-Fi or Claude are gone for a moment; say why they may be old
const problem = computed(() => {
  if (token.value?.state === 'invalid') return t('usage.missing.tokenInvalid')
  if (wifi.value && wifi.value.state !== 'connected') return t('usage.missing.waitingWifi')
  if (token.value?.problem) return t(`settings.claude.problem.${token.value.problem}`)
  return undefined
})

// Saving mode asks only every 30 minutes, so "old" depends on the mode
const staleAfterMs = computed(() => (mode.value === 'saving' ? 35 : 6) * 60000)
// fetched_at comes from the device (also after a restart); 0 = it didn't know the time yet
const fetchedAt = computed(() => (usage.value?.fetched_at ? usage.value.fetched_at * 1000 : undefined))
const stale = computed(() => !!fetchedAt.value && now.value - fetchedAt.value > staleAfterMs.value)

const updatedText = computed(() => {
  if (!fetchedAt.value) return undefined
  const minutes = Math.round((now.value - fetchedAt.value) / 60000)
  if (minutes < 1) return t('usage.updatedNow')
  // Stored numbers survive a restart, so they can be hours or days old
  const format = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  const ago =
    minutes < 60
      ? format.format(-minutes, 'minute')
      : minutes < 48 * 60
        ? format.format(-Math.round(minutes / 60), 'hour')
        : format.format(-Math.round(minutes / 1440), 'day')
  return t('usage.updated', { ago })
})
</script>
