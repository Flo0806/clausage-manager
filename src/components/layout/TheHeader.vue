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
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="btn-ghost relative px-2"
        :class="{ 'text-primary': debugOn }"
        :aria-pressed="debugOn"
        :title="debugOn ? $t('debug.off') : $t('debug.on')"
        @click="debugOn = !debugOn"
      >
        <span aria-hidden="true" class="i-lucide-bug inline-block text-xl" />
        <!-- Badge: the debugger is recording -->
        <span
          v-if="debugOn"
          class="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-surface"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="btn-secondary"
        :aria-label="$t('theme.label', { mode: $t(`theme.${themeMode}`) })"
        :title="$t(`theme.${themeMode}`)"
        @click="cycleTheme()"
      >
        <span aria-hidden="true" :class="[icons[themeMode], 'text-xl']" />
      </button>
    </div>

    <TheSidebar v-model="menuOpen" />
  </header>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { cycleTheme, themeMode } from '@/composables/theme'
import { useDebugLog } from '@/composables/debugLog.ts'
import TheSidebar from './TheSidebar.vue'

const icons = { auto: 'i-lucide-monitor', light: 'i-lucide-sun', dark: 'i-lucide-moon' } as const

const menuOpen = ref(false)
const { enabled: debugOn } = useDebugLog()
</script>
