<template>
  <input v-model="model" class="input" />
</template>

<script lang="ts" setup>
const model = defineModel<string>({ default: '' })
</script>
