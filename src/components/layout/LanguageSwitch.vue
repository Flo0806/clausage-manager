<template>
  <!-- SVG flags instead of emoji: Windows shows emoji flags as plain letters -->
  <button
    type="button"
    class="btn-ghost px-2"
    :aria-label="label"
    :title="label"
    @click="setLocale(next)"
  >
    <span :class="flags[current]" class="inline-block text-xl" aria-hidden="true" />
  </button>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { LOCALES, setLocale, type Locale } from '@/i18n'

const { t, locale } = useI18n()

// Full class names, so UnoCSS can find them
const flags: Record<Locale, string> = {
  de: 'i-circle-flags-de',
  en: 'i-circle-flags-gb',
}

// Each language named in its own words, so it can be found without understanding the current one
const names: Record<Locale, string> = { de: 'Deutsch', en: 'English' }

const current = computed(() => locale.value as Locale)
const next = computed(() => LOCALES[(LOCALES.indexOf(current.value) + 1) % LOCALES.length]!)

const label = computed(() =>
  t('language.switch', { current: names[current.value], next: names[next.value] }),
)
</script>
