<script setup lang="ts">
import { watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import TheHeader from './components/layout/TheHeader.vue'

const { t, locale } = useI18n()
watchEffect(() => {
  document.documentElement.lang = locale.value
  document.title = t('app.title')
})
</script>

<template>
  <TheHeader />
  <main class="mx-auto max-w-lg p-6 flex flex-col gap-6">
    <RouterView />
  </main>
</template>
