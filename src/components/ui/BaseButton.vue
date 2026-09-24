<template>
  <button :type="type" :class="variants[variant]">
    <slot />
  </button>
</template>

<script lang="ts" setup>
const { variant = 'primary', type = 'button' } = defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost'
  type?: 'button' | 'submit' | 'reset'
}>()

// Full class names so UnoCSS can extract them statically.
const variants = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
} as const
</script>
