<script setup lang="ts">
import { onMounted, onUnmounted, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import TheHeader from './components/layout/TheHeader.vue'
import { useSerial } from './composables/serial.ts'

const { t, locale } = useI18n()
const { connect, send, disconnect } = useSerial()

watchEffect(() => {
  document.documentElement.lang = locale.value
  document.title = t('app.title')
})

onMounted(async () => {})

onUnmounted(async () => {
  await disconnect()
})

async function sendToEsp() {
  await connect()
  send('Hello!')
}
</script>

<template>
  <TheHeader />
  <main class="mx-auto max-w-lg p-6 flex flex-col gap-6">
    <button class="btn btn-primary>" @click="sendToEsp()">Hello ESP!</button>

    <RouterView />
  </main>
</template>
