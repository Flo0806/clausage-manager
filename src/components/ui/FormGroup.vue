<template>
  <div class="flex flex-col gap-1.5">
    <label :for="id" class="text-sm font-medium text-fg">
      {{ label }}
      <span v-if="required" class="text-danger" aria-hidden="true">*</span>
    </label>

    <slot v-bind="field" />

    <p v-if="error" :id="errorId" class="text-sm text-danger">{{ error }}</p>
    <p v-else-if="hint" :id="hintId" class="text-sm text-muted">{{ hint }}</p>
  </div>
</template>

<script lang="ts" setup>
import { computed, useId } from 'vue'

const { label, hint, error, required } = defineProps<{
  label: string
  hint?: string
  error?: string
  required?: boolean
}>()

const id = useId()
const hintId = `${id}-hint`
const errorId = `${id}-error`

const field = computed(() => ({
  id,
  required,
  'aria-invalid': error ? true : undefined,
  'aria-describedby': error ? errorId : hint ? hintId : undefined,
}))
</script>
