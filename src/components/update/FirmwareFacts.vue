<template>
  <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
    <dt class="text-muted">{{ $t('update.version') }}</dt>
    <dd class="font-mono">{{ release.version }}</dd>
    <dt class="text-muted">{{ $t('update.board') }}</dt>
    <dd class="font-mono">{{ release.board }}</dd>
    <dt class="text-muted">{{ $t('update.released') }}</dt>
    <dd>{{ formatDate(release.released, locale) }}</dd>
    <dt class="text-muted">{{ $t('update.size') }}</dt>
    <dd>
      {{ formatSize(release.size, locale) }}
      <span class="text-muted">({{ release.size.toLocaleString(locale) }} Bytes)</span>
    </dd>
    <dt class="text-muted">SHA-256</dt>
    <dd class="break-all font-mono text-xs">{{ release.sha256 }}</dd>
  </dl>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { formatDate, formatSize, type FirmwareRelease } from '@/composables/firmware.ts'

defineProps<{ release: FirmwareRelease }>()

const { locale } = useI18n()
</script>
