<template>
  <!-- Native <dialog>: Esc and a click outside cancel (closedby="any") -->
  <dialog
    ref="dialog"
    closedby="any"
    :aria-label="title"
    class="m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg border border-border bg-surface p-6 text-fg backdrop:bg-black/60"
    @close="open = false"
  >
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 text-xl font-bold" :class="{ 'text-danger': danger }">
        <span v-if="danger" class="i-lucide-triangle-alert inline-block" aria-hidden="true" />
        {{ title }}
      </h2>

      <div class="text-sm">
        <slot />
      </div>

      <div class="flex flex-wrap justify-end gap-2">
        <button class="btn-ghost" @click="open = false">{{ $t('dialog.cancel') }}</button>
        <button :class="danger ? 'btn-danger' : 'btn-primary'" @click="confirm">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>

<script lang="ts" setup>
import { useTemplateRef, watch } from 'vue'

const open = defineModel<boolean>({ required: true })

defineProps<{
  title: string
  confirmLabel: string
  danger?: boolean
}>()

const emit = defineEmits<{ confirm: [] }>()

const dialog = useTemplateRef('dialog')

watch(open, (isOpen) => {
  if (isOpen) dialog.value?.showModal()
  else if (dialog.value?.open) dialog.value.close()
})

function confirm() {
  open.value = false
  emit('confirm')
}
</script>
