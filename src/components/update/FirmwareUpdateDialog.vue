<template>
  <!-- closedby="none": no Esc, no click outside. Only the button closes it, and only when finished. -->
  <dialog
    ref="dialog"
    closedby="none"
    :aria-label="$t('updateRun.title')"
    class="m-auto w-[calc(100vw-2rem)] max-w-md rounded-lg border border-border bg-surface p-6 text-fg backdrop:bg-black/60"
  >
    <div class="flex flex-col gap-5">
      <h2 class="flex items-center gap-2 text-xl font-bold">
        <span class="i-lucide-cpu inline-block" aria-hidden="true" />
        {{ $t('updateRun.title') }}
        <span v-if="release" class="font-mono">{{ release.version }}</span>
      </h2>

      <p
        v-if="running"
        role="alert"
        class="flex items-start gap-2 rounded-md bg-primary/10 p-3 text-sm text-primary"
      >
        <span class="i-lucide-triangle-alert mt-0.5 inline-block shrink-0" aria-hidden="true" />
        {{ $t('updateRun.doNotUnplug') }}
      </p>

      <ol class="flex flex-col gap-2 text-sm">
        <li v-for="step in steps" :key="step" class="flex items-center gap-2">
          <span :class="stepIcon(step)" class="inline-block shrink-0 text-lg" aria-hidden="true" />
          <span :class="{ 'text-muted': stepState(step) === 'pending' }">
            {{ $t(`updateRun.step.${step}`) }}
          </span>
        </li>
      </ol>

      <div
        v-if="phase === 'download' || phase === 'write'"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
        class="flex flex-col gap-1"
      >
        <div class="h-2 overflow-hidden rounded-full bg-fg/10">
          <div class="h-full bg-primary transition-[width]" :style="{ width: `${percent}%` }" />
        </div>
        <span class="self-end font-mono text-xs text-muted">{{ percent }} %</span>
      </div>

      <p v-if="phase === 'success'" role="status" class="flex items-center gap-2">
        <span class="i-lucide-circle-check inline-block text-primary" aria-hidden="true" />
        {{ $t('updateRun.success', { version: release?.version }) }}
      </p>

      <div
        v-if="phase === 'failed' && error"
        role="alert"
        class="flex flex-col gap-1 rounded-md bg-danger/10 p-3 text-sm text-danger"
      >
        <p class="flex items-start gap-2">
          <span class="i-lucide-circle-alert mt-0.5 inline-block shrink-0" aria-hidden="true" />
          {{ $t(`updateRun.error.${error}`, { detail: errorDetail, from: fromVersion }) }}
        </p>
        <p v-if="errorDetail" class="pl-6 font-mono text-xs opacity-80">{{ errorDetail }}</p>
      </div>

      <div v-if="!running" class="flex justify-end">
        <button class="btn-primary" @click="reset">{{ $t('updateRun.close') }}</button>
      </div>
    </div>
  </dialog>
</template>

<script lang="ts" setup>
import { computed, useTemplateRef, watch } from 'vue'
import { useFirmwareUpdate, type UpdatePhase } from '@/composables/firmwareUpdate.ts'

const { phase, progress, release, fromVersion, error, errorDetail, failedAt, running, reset } =
  useFirmwareUpdate()

const dialog = useTemplateRef('dialog')

watch(phase, (current) => {
  if (current !== 'idle' && !dialog.value?.open) dialog.value?.showModal()
  if (current === 'idle' && dialog.value?.open) dialog.value.close()
})

const steps = ['download', 'verify', 'erase', 'write', 'restart', 'check'] as const
type Step = (typeof steps)[number]

const percent = computed(() => Math.round(progress.value * 100))

function stepState(step: Step): 'done' | 'active' | 'failed' | 'pending' {
  const current: UpdatePhase = phase.value === 'failed' ? (failedAt.value ?? 'idle') : phase.value
  if (phase.value === 'success') return 'done'
  const index = steps.indexOf(step)
  const currentIndex = steps.indexOf(current as Step)
  if (index < currentIndex) return 'done'
  if (index === currentIndex) return phase.value === 'failed' ? 'failed' : 'active'
  return 'pending'
}

// Full class names, so UnoCSS can find them
const icons = {
  done: 'i-lucide-circle-check text-primary',
  active: 'i-lucide-loader-circle animate-spin text-primary',
  failed: 'i-lucide-circle-x text-danger',
  pending: 'i-lucide-circle text-muted',
} as const

const stepIcon = (step: Step) => icons[stepState(step)]
</script>
