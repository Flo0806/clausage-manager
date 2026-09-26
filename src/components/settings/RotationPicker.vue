<template>
  <fieldset class="flex flex-col gap-2">
    <legend class="mb-1 text-sm font-medium">{{ $t('settings.display.rotation') }}</legend>

    <div class="grid grid-cols-2 gap-3">
      <label
        v-for="side in sides"
        :key="side"
        class="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border p-3 transition-colors hover:border-primary/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
      >
        <input v-model="model" type="radio" :value="side" :name="id" class="sr-only" />

        <!-- The device from the front, the cable on the chosen side. The screen stays upright. -->
        <svg viewBox="0 0 120 70" class="w-full max-w-40" aria-hidden="true">
          <g class="fill-none stroke-muted" stroke-width="4" stroke-linecap="round">
            <path v-if="side === 'usb_left'" d="M2 35 H16" />
            <path v-else d="M104 35 H118" />
          </g>
          <rect
            :x="side === 'usb_left' ? 14 : 98"
            y="30"
            width="8"
            height="10"
            rx="2"
            class="fill-muted"
          />

          <rect x="22" y="7" width="76" height="56" rx="7" class="fill-fg/10 stroke-fg/40" />
          <rect x="29" y="14" width="62" height="42" rx="3" class="fill-bg" />

          <!-- A hint of the home screen: two usage bars -->
          <rect x="35" y="24" width="50" height="5" rx="2.5" class="fill-fg/15" />
          <rect x="35" y="24" width="22" height="5" rx="2.5" class="fill-success" />
          <rect x="35" y="41" width="50" height="5" rx="2.5" class="fill-fg/15" />
          <rect x="35" y="41" width="40" height="5" rx="2.5" class="fill-primary" />
        </svg>

        <span class="flex items-center gap-1 text-sm">
          <span
            :class="side === 'usb_left' ? 'i-lucide-arrow-left' : 'i-lucide-arrow-right'"
            class="inline-block"
            aria-hidden="true"
          />
          {{ $t(`settings.display.${side}`) }}
        </span>
      </label>
    </div>
  </fieldset>
</template>

<script lang="ts" setup>
import { useId } from 'vue'
import type { Rotation } from '@/composables/device.ts'

const model = defineModel<Rotation>({ required: true })
const id = useId()

const sides = ['usb_left', 'usb_right'] as const
</script>
