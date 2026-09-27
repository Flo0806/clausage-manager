<template>
  <div class="flex flex-col gap-1.5">
    <div class="flex items-baseline justify-between gap-2">
      <span class="flex flex-wrap items-center gap-2">
        <span class="font-medium">{{ label }}</span>
        <span
          v-if="forecast"
          class="rounded-full px-2 py-0.5 text-xs"
          :class="forecastBadge[forecast]"
          :title="$t('usage.forecastHint')"
        >
          {{ forecastText }}
        </span>
      </span>
      <span class="font-mono text-2xl font-semibold" :class="textColor">{{ percent }} %</span>
    </div>

    <div
      role="progressbar"
      :aria-label="label"
      :aria-valuenow="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuetext="`${percent} %, ${resetText}`"
      class="h-2.5 overflow-hidden rounded-full bg-fg/10"
    >
      <div
        class="h-full rounded-full transition-[width] duration-500"
        :class="barColor"
        :style="{ width: `${percent}%` }"
      />
    </div>

    <span class="text-sm text-muted" :title="resetExact">{{ resetText }}</span>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UsageWindow } from '@/composables/device.ts'

const props = defineProps<{
  label: string
  window: UsageWindow
  kind: 'five_hour' | 'seven_day'
  now: number // Date.now(), ticking in the parent
}>()

const { t, locale } = useI18n()

const resetsAt = computed(() => props.window.resets_at * 1000)

// Like the display: a window that has run out shows 0 % without waiting for Claude
const expired = computed(() => resetsAt.value <= props.now)
const percent = computed(() => (expired.value ? 0 : Math.round(props.window.percent)))

// Same thresholds as the display: olive, orange from 80 %, red from 95 %
const level = computed(() => (percent.value >= 95 ? 'danger' : percent.value >= 80 ? 'warn' : 'ok'))
const barColors = { ok: 'bg-success', warn: 'bg-primary', danger: 'bg-danger' } as const
const textColors = { ok: 'text-fg', warn: 'text-primary', danger: 'text-danger' } as const
const barColor = computed(() => barColors[level.value])
const textColor = computed(() => textColors[level.value])

// Same badges as the display; none when unknown or when the window has already run out
const forecast = computed(() => {
  const value = props.window.forecast
  return !expired.value && value && value !== 'unknown' ? value : undefined
})
const forecastBadge = {
  on_track: 'bg-success/15 text-success',
  tight: 'bg-primary/15 text-primary',
  too_fast: 'bg-danger/15 text-danger',
} as const

// 5 hours: time of day; week: weekday and time
function formatMoment(ms: number) {
  return new Intl.DateTimeFormat(locale.value, {
    ...(props.kind === 'seven_day' && { weekday: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms)
}

const forecastText = computed(() => {
  if (forecast.value === 'too_fast' && props.window.limit_at) {
    return t('usage.forecast.too_fast_at', { when: formatMoment(props.window.limit_at * 1000) })
  }
  return forecast.value ? t(`usage.forecast.${forecast.value}`) : ''
})

// 5 hours: countdown "1:23 h"; week: weekday and time "Tue 21:00"
const resetText = computed(() => {
  if (expired.value) return t('usage.newWindow')
  if (props.kind === 'five_hour') {
    const minutes = Math.max(0, Math.ceil((resetsAt.value - props.now) / 60000))
    const time = `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`
    return t('usage.resetsIn', { time })
  }
  const when = new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(resetsAt.value)
  return t('usage.resetsAt', { when })
})

const resetExact = computed(() =>
  new Intl.DateTimeFormat(locale.value, { dateStyle: 'full', timeStyle: 'short' }).format(
    resetsAt.value,
  ),
)
</script>
