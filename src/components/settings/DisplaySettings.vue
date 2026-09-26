<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <h2 class="col-span-6 mb-2 text-2xl font-bold">{{ $t('settings.display.title') }}</h2>

      <p v-if="!loaded" class="col-span-6 flex items-center gap-2 text-muted">
        <span class="i-lucide-unplug inline-block shrink-0" aria-hidden="true" />
        {{ $t('settings.display.noDevice') }}
      </p>

      <div v-else class="col-span-6 flex flex-col gap-6">
        <div class="flex flex-col gap-1.5">
          <label :for="`${id}-brightness`" class="flex justify-between text-sm font-medium">
            {{ $t('settings.display.brightness') }}
            <span class="font-mono tabular-nums">{{ brightness }} %</span>
          </label>
          <input
            :id="`${id}-brightness`"
            v-model.number="brightness"
            type="range"
            min="5"
            max="100"
            step="5"
            class="w-full accent-primary"
            :disabled="busy"
          />
        </div>

        <RotationPicker v-model="rotation" />

        <fieldset class="flex flex-col gap-4">
          <legend class="mb-1 text-sm font-medium">{{ $t('settings.display.polling') }}</legend>

          <FormGroup
            v-slot="field"
            :label="$t('settings.display.activeLabel')"
            :hint="$t('settings.display.minutesRange')"
            :error="activeError"
          >
            <BaseInput v-bind="field" v-model="activeMin" type="number" min="1" max="360" />
          </FormGroup>

          <FormGroup
            v-slot="field"
            :label="$t('settings.display.savingLabel')"
            :hint="$t('settings.display.minutesRange')"
            :error="savingError"
          >
            <BaseInput v-bind="field" v-model="savingMin" type="number" min="1" max="360" />
          </FormGroup>

          <FormGroup
            v-slot="field"
            :label="$t('settings.display.idleLabel')"
            :hint="idleHint"
            :error="idleError"
          >
            <BaseInput v-bind="field" v-model="idlePolls" type="number" min="1" max="100" />
          </FormGroup>

          <p class="flex items-start gap-2 text-sm text-muted">
            <span class="i-lucide-info mt-0.5 inline-block shrink-0" aria-hidden="true" />
            {{ $t('settings.display.limitHint', { seconds: minInterval }) }}
          </p>

        </fieldset>

        <div class="flex flex-wrap gap-2">
          <button
            class="btn-primary"
            :disabled="busy || !dirty || invalid"
            @click="save"
          >
            {{ $t('settings.display.save') }}
          </button>
          <button class="btn-ghost" :disabled="busy" @click="useDefaults">
            {{ $t('settings.display.defaults') }}
          </button>
        </div>

        <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
      </div>
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '../ui/BaseCard.vue'
import BaseInput from '../ui/BaseInput.vue'
import FormGroup from '../ui/FormGroup.vue'
import RotationPicker from './RotationPicker.vue'
import { useSerial } from '@/composables/serial.ts'
import {
  useDevice,
  type DeviceSettings,
  type Rotation,
  type SettingsReply,
} from '@/composables/device.ts'

const { t, te } = useI18n()
const { connected } = useSerial()
const { getSettings, setSettings } = useDevice()
const id = useId()

// Defaults from the firmware README
const DEFAULTS = {
  brightness: 100,
  rotation: 'usb_left' as Rotation,
  active_s: 120,
  saving_s: 1800,
  idle_polls: 10,
}

const loaded = ref(false)
const saved = ref<DeviceSettings>()
const busy = ref(false)
const error = ref<string>()

const brightness = ref(100)
const rotation = ref<Rotation>('usb_left')
// Intervals are edited in minutes, the device works in seconds
const activeMin = ref('')
const savingMin = ref('')
const idlePolls = ref('')
const minInterval = computed(() => saved.value?.min_interval_s ?? 60)

function fill(settings: DeviceSettings) {
  saved.value = settings
  brightness.value = settings.brightness
  rotation.value = settings.rotation ?? DEFAULTS.rotation // older firmware has no rotation
  activeMin.value = String(settings.active_s / 60)
  savingMin.value = String(settings.saving_s / 60)
  idlePolls.value = String(settings.idle_polls)
  loaded.value = true
}

// Load when a device is (or becomes) connected; forget the values when it goes away
watch(
  connected,
  async (isConnected) => {
    loaded.value = false
    error.value = undefined
    if (!isConnected) return
    const reply = await getSettings()
    if (reply?.ok && reply.settings) fill(reply.settings)
  },
  { immediate: true },
)

// Whole minutes within the device's range (1 min .. 6 h)
function minutesError(value: string) {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 && n <= 360 ? undefined : t('settings.display.minutesRange')
}
const activeError = computed(() => minutesError(activeMin.value))
const savingError = computed(() => minutesError(savingMin.value))
const idleError = computed(() => {
  const n = Number(idlePolls.value)
  return Number.isInteger(n) && n >= 1 && n <= 100 ? undefined : t('settings.display.idleRange')
})
const invalid = computed(() => !!(activeError.value || savingError.value || idleError.value))

const idleHint = computed(() => {
  const minutes = Number(idlePolls.value) * Number(activeMin.value)
  return Number.isFinite(minutes) && minutes > 0
    ? t('settings.display.idleHint', { minutes })
    : t('settings.display.idleRange')
})

const dirty = computed(
  () =>
    !!saved.value &&
    (brightness.value !== saved.value.brightness ||
      (saved.value.rotation !== undefined && rotation.value !== saved.value.rotation) ||
      Number(activeMin.value) * 60 !== saved.value.active_s ||
      Number(savingMin.value) * 60 !== saved.value.saving_s ||
      Number(idlePolls.value) !== saved.value.idle_polls),
)

// Unknown error codes (e.g. "unknown_command") fall back to a generic text
function errorText(code?: string) {
  const key = `settings.display.errors.${code}`
  return te(key) ? t(key) : t('settings.display.errors.unknown')
}

// Everything in one request: the device checks all fields first, one bad value changes nothing
async function save() {
  busy.value = true
  error.value = undefined
  try {
    const reply: SettingsReply | undefined = await setSettings({
      brightness: brightness.value,
      // Only when the firmware knows it, an older one would answer "invalid"
      ...(saved.value?.rotation !== undefined && { rotation: rotation.value }),
      active_s: Number(activeMin.value) * 60,
      saving_s: Number(savingMin.value) * 60,
      idle_polls: Number(idlePolls.value),
    })
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = errorText(reply.error)
    else if (reply.settings) fill(reply.settings) // show what the device really stored
  } finally {
    busy.value = false
  }
}

// Fills the form only; "Save" sends it
function useDefaults() {
  brightness.value = DEFAULTS.brightness
  rotation.value = DEFAULTS.rotation
  activeMin.value = String(DEFAULTS.active_s / 60)
  savingMin.value = String(DEFAULTS.saving_s / 60)
  idlePolls.value = String(DEFAULTS.idle_polls)
}
</script>
