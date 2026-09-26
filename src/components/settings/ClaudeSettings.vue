<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="text-2xl font-bold mb-2">{{ $t('settings.claude.title') }}</h2>

      <div class="col-span-6">
        <FormGroup
          v-slot="field"
          :label="$t('settings.claude.label')"
          :error="noCodeError"
          required
        >
          <BaseInput
            v-bind="field"
            v-model="token"
            :placeholder="$t('settings.claude.placeholder')"
            @blur="blured = true"
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

const token = ref('')
const blured = ref(false)

const noCodeError = computed(() =>
  blured.value && !token.value.trim() ? t('settings.claude.error') : undefined,
)

const code = computed(() => (token.value ? 'CLAUDE:' + token.value : undefined))
</script>
