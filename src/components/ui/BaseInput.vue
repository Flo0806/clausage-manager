<template>
  <input v-bind="$attrs" v-model="model" class="input" />
</template>

<script lang="ts" setup>
const model = defineModel<string>({ default: '' })
</script>
