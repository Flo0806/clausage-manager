<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="text-2xl font-bold mb-2">{{ $t('settings.hello.title') }}</h2>

      <div class="col-span-6 flex flex-col gap-4">
        <div>
          <button class="btn btn-primary" :disabled="loading" @click="sayHello">
            {{ $t('settings.hello.buttonText') }}
          </button>
        </div>

        <HelloResponse :response="response" :error="error" />
      </div>
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import { onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSerial } from '@/composables/serial.ts'
import BaseCard from '../ui/BaseCard.vue'
import HelloResponse, { type HelloReply } from './HelloResponse.vue'

const REPLY_TIMEOUT_MS = 3000

const { t } = useI18n()
const { connect, connected, send, receive } = useSerial()

const stopReceiving = receive((line) => console.log('[esp]', line))
onUnmounted(stopReceiving)

const loading = ref(false)
const response = ref<HelloReply>()
const error = ref<string>()

watch(connected, (isConnected) => {
  if (!isConnected) response.value = undefined
})

// Resolves with the JSON reply carrying `id`, or undefined after the timeout
function waitForReply(id: number): Promise<HelloReply | undefined> {
  return new Promise((resolve) => {
    const stop = receive((line) => {
      let reply: HelloReply
      try {
        reply = JSON.parse(line)
      } catch {
        return // not JSON, e.g. a log line
      }
      if (reply.id !== id) return
      clearTimeout(timer)
      stop()
      resolve(reply)
    })
    const timer = setTimeout(() => {
      stop()
      resolve(undefined)
    }, REPLY_TIMEOUT_MS)
  })
}

async function sayHello() {
  loading.value = true
  response.value = undefined
  error.value = undefined

  try {
    await connect()
    if (!connected.value) {
      error.value = t('settings.hello.errorConnect')
      return
    }

    const reply = waitForReply(1) // listen before sending, so no answer is missed
    await send(JSON.stringify({ id: 1, cmd: 'hello' }))
    const result = await reply

    if (!result) error.value = t('settings.hello.errorTimeout')
    else if (!result.ok) error.value = t('settings.hello.errorDevice')
    else response.value = result
  } finally {
    loading.value = false
  }
}
</script>
