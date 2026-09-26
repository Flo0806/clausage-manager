<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="text-2xl font-bold mb-2 col-span-6">{{ $t('settings.hello.title') }}</h2>

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
const { connect, connected, request, receive } = useSerial()

const stopReceiving = receive((line) => console.log('[esp]', line))
onUnmounted(stopReceiving)

const loading = ref(false)
const response = ref<HelloReply>()
const error = ref<string>()

watch(connected, (isConnected) => {
  if (!isConnected) response.value = undefined
})

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

    const result = await request<HelloReply>('hello', {}, REPLY_TIMEOUT_MS)
    console.log('result', result)
    if (!result) error.value = t('settings.hello.errorTimeout')
    else if (!result.ok) error.value = t('settings.hello.errorDevice')
    else response.value = result
  } finally {
    loading.value = false
  }
}
</script>
