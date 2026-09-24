import { computed } from 'vue'
import { useColorMode } from '@vueuse/core'

export type ThemeMode = 'auto' | 'light' | 'dark'

// Adds/removes `dark` on <html> and stores the choice in localStorage
// ('vueuse-color-scheme' – must match the inline script in index.html).
// `store` is the user's choice (including 'auto'), while `state` is the effective theme.
const { store, state } = useColorMode()

export const themeMode = store
export const isDark = computed(() => state.value === 'dark')

const order: ThemeMode[] = ['auto', 'light', 'dark']
export function cycleTheme() {
  store.value = order[(order.indexOf(store.value) + 1) % order.length]!
}
