import { createI18n } from 'vue-i18n'
import { useLocalStorage } from '@vueuse/core'
import en from './locales/en.json'
import de from './locales/de.json'

export const LOCALES = ['de', 'en'] as const
export type Locale = (typeof LOCALES)[number]

// Only a choice made in the header is stored; without one the browser language wins
const stored = useLocalStorage<Locale | null>('locale', null)
const detected: Locale = navigator.language.startsWith('de') ? 'de' : 'en'

export const i18n = createI18n({
  legacy: false,
  locale: stored.value && LOCALES.includes(stored.value) ? stored.value : detected,
  fallbackLocale: 'en',
  messages: { en, de },
})

export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale
  stored.value = locale
}
