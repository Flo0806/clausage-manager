<template>
  <div>
    <h1 class="text-3xl font-semibold flex items-center gap-2 mb-6">
      <span class="i-lucide-download inline-block" aria-hidden="true" />
      {{ $t('nav.update') }}
    </h1>

    <p v-if="loading && !releases.length" class="flex items-center gap-2 text-muted">
      <span class="i-lucide-loader-circle inline-block animate-spin" aria-hidden="true" />
      {{ $t('update.loading') }}
    </p>

    <div
      v-else-if="error"
      role="alert"
      class="flex flex-col items-start gap-3 rounded-md bg-danger/10 p-4 text-danger"
    >
      <p class="flex items-center gap-2">
        <span class="i-lucide-circle-alert inline-block shrink-0" aria-hidden="true" />
        {{ $t('update.loadError') }}
      </p>
      <button class="btn-secondary" @click="reload">{{ $t('update.retry') }}</button>
    </div>

    <p v-else-if="!releases.length" class="text-muted">{{ $t('update.empty') }}</p>

    <ul v-else class="flex flex-col gap-3">
      <FirmwareListItem
        v-for="(release, index) in releases"
        :key="`${release.board}/${release.version}`"
        :release="release"
        :latest="index === 0"
        :installed="isInstalled(release)"
      />
    </ul>
  </div>
</template>

<script lang="ts" setup>
import FirmwareListItem from '@/components/update/FirmwareListItem.vue'
import { useDevice } from '@/composables/device.ts'
import { useFirmware, type FirmwareRelease } from '@/composables/firmware.ts'

const { releases, loading, error, ensureLoaded, reload } = useFirmware()
const { info } = useDevice()

ensureLoaded()

// Marked once a device is connected and reports this board and version
function isInstalled(release: FirmwareRelease) {
  return info.value?.board === release.board && info.value?.version === release.version
}
</script>
