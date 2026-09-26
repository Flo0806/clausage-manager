<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="text-2xl font-bold mb-2">{{ $t('settings.wlan.title') }}</h2>

      <div class="col-span-6">
        <FormGroup
          v-slot="field"
          :label="$t('settings.wlan.ssidLabel')"
          :error="ssidError"
          required
        >
          <BaseInput
            v-bind="field"
            v-model="ssid"
            :placeholder="$t('settings.wlan.ssidPlaceholder')"
            @blur="ssidBlured = true"
          />
        </FormGroup>

        <FormGroup
          class="mt-4"
          v-slot="field"
          :label="$t('settings.wlan.passwordLabel')"
          :error="passwordError"
          required
        >
          <BaseInput
            v-bind="field"
            v-model="password"
            :placeholder="$t('settings.wlan.passwordPlaceholder')"
            @blur="passwordBlured = true"
          />
        </FormGroup>
      </div>

      <QrcodeVue
        class="mt-5 col-span-6 w-full h-auto"
        v-if="code"
        :value="code"
        level="H"
        render-as="svg"
      />
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import QrcodeVue from 'qrcode.vue'
import BaseInput from '../ui/BaseInput.vue'
import FormGroup from '../ui/FormGroup.vue'

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '../ui/BaseCard.vue'

const { t } = useI18n()

const ssid = ref('')
const password = ref('')
const ssidBlured = ref(false)
const passwordBlured = ref(false)

const ssidError = computed(() =>
  ssidBlured.value && !ssid.value.trim() ? t('settings.wlan.ssidError') : undefined,
)

const passwordError = computed(() =>
  passwordBlured.value && !password.value.trim() ? t('settings.wlan.passwordError') : undefined,
)

const code = computed(() => {
  if (ssidBlured.value && passwordBlured) {
    return `WIFI:S:${ssid.value};T:WPA;P:${password.value}`
  }
  return undefined
})
</script>
