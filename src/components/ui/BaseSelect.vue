<template>
  <!-- The native arrow can't be positioned reliably, so it is hidden and replaced by an icon -->
  <div class="relative">
    <select v-bind="$attrs" v-model="model" class="input appearance-none pr-10">
      <slot />
    </select>
    <span
      class="i-lucide-chevron-down pointer-events-none absolute right-3 top-1/2 inline-block -translate-y-1/2 text-muted"
      aria-hidden="true"
    />
  </div>
</template>

<script lang="ts" setup>
// Attributes (id, aria-*, disabled) belong on the <select>, not on the wrapper
defineOptions({ inheritAttrs: false })

const model = defineModel<string>()
</script>
