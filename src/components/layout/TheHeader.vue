<template>
  <header class="flex items-center justify-between p-4 bg-surface text-fg border-b border-border">
    <h1 class="text-xl">Clausage Manager</h1>
    <button
      type="button"
      class="btn-secondary"
      :aria-label="$t('theme.label', { mode: $t(`theme.${themeMode}`) })"
      :title="$t(`theme.${themeMode}`)"
      @click="cycleTheme()"
    >
      <span aria-hidden="true" :class="[icons[themeMode], 'text-xl']" />
    </button>
  </header>
</template>

<script lang="ts" setup>
import { cycleTheme, themeMode } from '@/composables/theme'

const icons = { auto: 'i-lucide-monitor', light: 'i-lucide-sun', dark: 'i-lucide-moon' } as const
</script>
