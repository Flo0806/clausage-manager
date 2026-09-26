<template>
  <div class="flex flex-col gap-6">
    <RouterLink
      to="/update"
      class="flex items-center gap-1 self-start text-sm text-muted hover:text-fg"
    >
      <span class="i-lucide-chevron-left inline-block" aria-hidden="true" />
      {{ $t('update.back') }}
    </RouterLink>

    <p v-if="loading && !release" class="flex items-center gap-2 text-muted">
      <span class="i-lucide-loader-circle inline-block animate-spin" aria-hidden="true" />
      {{ $t('update.loading') }}
    </p>

    <p v-else-if="!release" role="alert" class="text-danger">
      {{ error ? $t('update.loadError') : $t('update.notFound') }}
    </p>

    <template v-else>
      <h1 class="text-3xl font-semibold flex flex-wrap items-center gap-2">
        <span class="i-lucide-cpu inline-block" aria-hidden="true" />
        Firmware <span class="font-mono">{{ release.version }}</span>
      </h1>

      <BaseCard>
        <FirmwareFacts :release="release" />
      </BaseCard>

      <BaseCard>
        <h2 class="text-2xl font-bold">{{ $t('update.startTitle') }}</h2>

        <p v-if="installed" class="flex items-center gap-2 text-sm">
          <span class="i-lucide-circle-check inline-block text-primary" aria-hidden="true" />
          {{ $t('update.alreadyInstalled') }}
        </p>
        <p v-else-if="info" class="text-sm">
          {{ $t('update.fromTo', { from: info.version, to: release.version }) }}
        </p>
        <p v-else class="flex items-center gap-2 text-sm text-muted">
          <span class="i-lucide-unplug inline-block shrink-0" aria-hidden="true" />
          {{ $t('update.noDevice') }}
        </p>

        <div>
          <button class="btn-primary" disabled>{{ $t('update.start') }}</button>
        </div>
      </BaseCard>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import BaseCard from '@/components/ui/BaseCard.vue'
import FirmwareFacts from '@/components/update/FirmwareFacts.vue'
import { useDevice } from '@/composables/device.ts'
import { useFirmware } from '@/composables/firmware.ts'

const route = useRoute('/update/[board]/[version]')
const { loading, error, ensureLoaded, findRelease } = useFirmware()
const { info } = useDevice()

ensureLoaded()

const release = computed(() => findRelease(route.params.board, route.params.version))

const installed = computed(
  () =>
    info.value?.board === release.value?.board && info.value?.version === release.value?.version,
)
</script>
