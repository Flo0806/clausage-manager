<template>
  <BaseCard>
    <div class="grid grid-cols-6">
      <div class="col-span-6 mb-2 flex items-center justify-between">
        <h2 class="text-2xl font-bold">{{ $t('settings.timezone.title') }}</h2>
        <span
          role="img"
          :aria-label="statusText"
          :title="statusText"
          :class="isSet ? 'text-primary' : 'text-muted'"
          class="i-lucide-clock inline-block text-2xl"
        />
      </div>

      <div class="col-span-6 flex flex-col gap-4">
        <p v-if="timezone" class="text-sm">
          {{ $t('settings.timezone.onDevice') }}
          <span class="font-mono">{{ timezone.name }}</span>
          <span v-if="!isSet" class="text-muted">({{ $t('settings.timezone.notSet') }})</span>
        </p>

        <FormGroup v-slot="field" :label="$t('settings.timezone.label')">
          <BaseSelect v-bind="field" v-model="selected" :disabled="!zoneNames.length">
            <option v-for="name in zoneNames" :key="name" :value="name">{{ name }}</option>
          </BaseSelect>
        </FormGroup>

        <p v-if="selected" class="text-sm text-muted">
          {{ $t('settings.timezone.localTime', { time: localTime }) }}
        </p>

        <p
          v-if="browserZone && browserZone !== timezone?.name && browserZone !== selected"
          class="flex flex-wrap items-center gap-2 text-sm"
        >
          {{ $t('settings.timezone.browserUses', { zone: browserZone }) }}
          <button class="btn-ghost px-2 py-1 text-sm" @click="selected = browserZone">
            {{ $t('settings.timezone.useBrowser') }}
          </button>
        </p>

        <div>
          <button
            class="btn-primary"
            :disabled="busy || !selected || selected === timezone?.name"
            @click="save"
          >
            {{ $t('settings.timezone.save') }}
          </button>
        </div>

        <p v-if="error" role="alert" class="text-sm text-danger">{{ error }}</p>
      </div>
    </div>
  </BaseCard>
</template>

<script lang="ts" setup>
import { computed, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseCard from '../ui/BaseCard.vue'
import BaseSelect from '../ui/BaseSelect.vue'
import FormGroup from '../ui/FormGroup.vue'
import { useSerial } from '@/composables/serial.ts'
import { useDevice } from '@/composables/device.ts'

const { t, te, locale } = useI18n()
const { connect, connected } = useSerial()
const { timezone, setTimezone } = useDevice()

// IANA name -> POSIX rule, from the posix_tz_db project. Loaded only when this card is shown.
const zones = ref<Record<string, string>>({})
void import('@/assets/timezones/zones.json').then((m) => (zones.value = m.default))
const zoneNames = computed(() => Object.keys(zones.value).sort())

// Browsers sometimes report an old or a newer name than the table uses
const aliases: Record<string, string> = {
  UTC: 'Etc/UTC',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Kyiv': 'Europe/Kiev',
}

const browserZone = computed(() => {
  const name = Intl.DateTimeFormat().resolvedOptions().timeZone
  const known = aliases[name] ?? name
  return known in zones.value ? known : undefined // not in the table: pick it by hand
})

// The device runs on UTC until the web app has set a zone
const isSet = computed(() => !!timezone.value && !['UTC', 'Etc/UTC'].includes(timezone.value.name))

const statusText = computed(() =>
  isSet.value
    ? t('settings.timezone.status', { zone: timezone.value?.name })
    : t('settings.timezone.notSet'),
)

// Preselect: the device's zone if it has one, otherwise the browser's
const selected = ref<string>()
watch(
  [timezone, browserZone],
  () => {
    if (selected.value) return
    selected.value = isSet.value ? timezone.value?.name : browserZone.value
  },
  { immediate: true },
)

// Live clock for the selected zone, so the choice is easy to check
const now = ref(new Date())
const clock = setInterval(() => (now.value = new Date()), 30000)
onUnmounted(() => clearInterval(clock))
const localTime = computed(() =>
  selected.value
    ? new Intl.DateTimeFormat(locale.value, { timeStyle: 'short', timeZone: selected.value }).format(
        now.value,
      )
    : '',
)

// Unknown error codes (e.g. "unknown_command") fall back to a generic text
function errorText(code?: string) {
  const key = `settings.timezone.errors.${code}`
  return te(key) ? t(key) : t('settings.timezone.errors.unknown')
}

const busy = ref(false)
const error = ref<string>()

// Auto-connect happens without a click, so an old connection error must go away by itself
watch(connected, (isConnected) => {
  if (isConnected) error.value = undefined
})

async function save() {
  const name = selected.value
  const rule = name && zones.value[name]
  if (!name || !rule) return

  busy.value = true
  error.value = undefined
  try {
    await connect()
    if (!connected.value) {
      error.value = t('settings.device.errorConnect')
      return
    }
    const reply = await setTimezone(name, rule)
    if (!reply) error.value = t('settings.device.errorTimeout')
    else if (!reply.ok) error.value = errorText(reply.error)
  } finally {
    busy.value = false
  }
}
</script>
