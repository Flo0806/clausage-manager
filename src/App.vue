<script setup lang="ts">
import { watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import TheHeader from './components/layout/TheHeader.vue'
import FirmwareUpdateDialog from './components/update/FirmwareUpdateDialog.vue'

const { t, locale } = useI18n()
watchEffect(() => {
  document.documentElement.lang = locale.value
  document.title = t('app.title')
})
</script>

<template>
  <TheHeader />
  <main class="mx-auto max-w-xl p-6 flex flex-col gap-6">
    <RouterView />
  </main>
  <FirmwareUpdateDialog />
</template>
