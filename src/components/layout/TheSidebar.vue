<template>
  <!--
    Native <dialog>: Esc, focus trap, inert background and, via closedby="any", closing on a click
    outside (press and release both outside, so a text selection ending there doesn't count)
  -->
  <dialog
    ref="dialog"
    closedby="any"
    :aria-label="$t('nav.label')"
    class="m-0 h-full max-h-none w-72 max-w-[80vw] flex-col gap-2 border-r border-border bg-surface p-4 text-fg open:flex backdrop:bg-black/50 animate-slide-in-left animate-duration-200 animate-ease-out motion-reduce:animate-none"
    @close="open = false"
  >
    <div class="mb-4 flex items-center justify-between">
      <span class="text-lg font-semibold">{{ $t('app.title') }}</span>
      <button
        type="button"
        class="btn-ghost px-2"
        :aria-label="$t('nav.close')"
        @click="open = false"
      >
        <span class="i-lucide-x inline-block text-xl" aria-hidden="true" />
      </button>
    </div>

    <nav>
      <ul class="flex flex-col gap-1">
        <li v-for="item in items" :key="item.to">
          <RouterLink
            :to="item.to"
            class="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-fg/10"
            :active-class="item.to === '/' ? '' : 'bg-primary/10 text-primary font-medium'"
            exact-active-class="bg-primary/10 text-primary font-medium"
          >
            <span :class="item.icon" class="inline-block text-xl" aria-hidden="true" />
            {{ $t(item.label) }}
          </RouterLink>
        </li>
      </ul>
    </nav>
  </dialog>
</template>

<script lang="ts" setup>
import { useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

const open = defineModel<boolean>({ default: false })
const dialog = useTemplateRef('dialog')
const route = useRoute()

// Full class names, so UnoCSS can find them
const items = [
  { to: '/', label: 'nav.home', icon: 'i-lucide-house' },
  { to: '/settings', label: 'nav.settings', icon: 'i-lucide-settings' },
  { to: '/update', label: 'nav.update', icon: 'i-lucide-download' },
] as const

watch(open, (isOpen) => {
  if (isOpen) dialog.value?.showModal()
  else if (dialog.value?.open) dialog.value.close()
})

// Close after navigating
watch(
  () => route.path,
  () => (open.value = false),
)
</script>
