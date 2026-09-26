<template>
  <div>
    <h1 class="text-3xl font-semibold flex items-center mb-6">
      <span class="i-lucide-settings inline-block"></span> <span>&nbsp;Settings</span>
    </h1>
    <div class="space-y-8">
      <DeviceSettings />
      <ClaudeSettings />
      <WlanSettings />
    </div>
  </div>
</template>

<script lang="ts" setup>
import ClaudeSettings from '@/components/settings/ClaudeSettings.vue'
import DeviceSettings from '@/components/settings/DeviceSettings.vue'
import WlanSettings from '@/components/settings/WlanSettings.vue'
</script>
