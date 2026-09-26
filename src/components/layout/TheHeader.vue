<template>
  <header class="flex items-center justify-between p-4 bg-surface text-fg border-b border-border">
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="btn-ghost px-2"
        :aria-label="$t('nav.open')"
        aria-haspopup="dialog"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
      >
        <span aria-hidden="true" class="i-lucide-menu inline-block text-xl" />
      </button>
      <h1 class="text-xl">Clausage Manager</h1>
    </div>
    <button
      type="button"
      class="btn-secondary"
      :aria-label="$t('theme.label', { mode: $t(`theme.${themeMode}`) })"
      :title="$t(`theme.${themeMode}`)"
      @click="cycleTheme()"
    >
      <span aria-hidden="true" :class="[icons[themeMode], 'text-xl']" />
    </button>

    <TheSidebar v-model="menuOpen" />
  </header>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { cycleTheme, themeMode } from '@/composables/theme'
import TheSidebar from './TheSidebar.vue'

const icons = { auto: 'i-lucide-monitor', light: 'i-lucide-sun', dark: 'i-lucide-moon' } as const

const menuOpen = ref(false)
</script>
