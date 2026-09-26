<template>
  <li>
    <RouterLink
      :to="`/update/${release.board}/${release.version}`"
      class="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
      :class="{ 'border-primary/60': installed }"
    >
      <span class="i-lucide-cpu inline-block shrink-0 text-3xl text-muted" aria-hidden="true" />

      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-lg font-semibold">{{ release.version }}</span>
          <span v-if="latest" class="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">
            {{ $t('update.latest') }}
          </span>
          <span
            v-if="installed"
            class="flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-on-primary"
          >
            <span class="i-lucide-check inline-block" aria-hidden="true" />
            {{ $t('update.installed') }}
          </span>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span class="font-mono">{{ release.board }}</span>
          <span>{{ formatDate(release.released, locale) }}</span>
          <span>{{ formatSize(release.size, locale) }}</span>
        </div>
      </div>

      <span class="i-lucide-chevron-right inline-block shrink-0 text-xl text-muted" aria-hidden="true" />
    </RouterLink>
  </li>
</template>

<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { formatDate, formatSize, type FirmwareRelease } from '@/composables/firmware.ts'

defineProps<{
  release: FirmwareRelease
  latest?: boolean
  installed?: boolean
}>()

const { locale } = useI18n()
</script>
