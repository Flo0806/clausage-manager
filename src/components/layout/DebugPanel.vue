<template>
  <section
    v-if="enabled"
    ref="panel"
    :aria-label="$t('debug.title')"
    class="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-surface text-fg shadow-2xl"
    :class="{ resize: !state.minimized }"
    :style="panelStyle"
  >
    <!-- The bar is the drag handle; buttons in it stay clickable -->
    <header
      ref="handle"
      class="flex cursor-move select-none items-center gap-1 border-b border-border px-2 py-1 text-sm"
    >
      <span class="i-lucide-bug inline-block shrink-0 text-primary" aria-hidden="true" />
      <span class="font-semibold">{{ $t('debug.title') }}</span>
      <span class="font-mono text-xs text-muted">{{ visible.length }}</span>

      <template v-if="!state.minimized">
        <select
          v-model="filter"
          class="ml-2 rounded border border-border bg-bg px-1 py-0.5 text-xs"
          :aria-label="$t('debug.filter')"
        >
          <option value="all">{{ $t('debug.filterAll') }}</option>
          <option value="json">{{ $t('debug.filterJson') }}</option>
          <option value="log">{{ $t('debug.filterLog') }}</option>
        </select>
      </template>

      <span class="flex-1" />

      <template v-if="!state.minimized">
        <button
          type="button"
          class="btn-ghost px-1.5 py-1"
          :class="{ 'text-primary': autoScroll }"
          :aria-pressed="autoScroll"
          :title="$t('debug.autoScroll')"
          @click="autoScroll = !autoScroll"
        >
          <span class="i-lucide-chevrons-down inline-block" aria-hidden="true" />
        </button>
        <button type="button" class="btn-ghost px-1.5 py-1" :title="$t('debug.copy')" @click="copy">
          <span
            :class="copied ? 'i-lucide-check text-success' : 'i-lucide-copy'"
            class="inline-block"
            aria-hidden="true"
          />
        </button>
        <button type="button" class="btn-ghost px-1.5 py-1" :title="$t('debug.save')" @click="save">
          <span class="i-lucide-download inline-block" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="btn-ghost px-1.5 py-1"
          :title="$t('debug.clear')"
          @click="clear"
        >
          <span class="i-lucide-trash-2 inline-block" aria-hidden="true" />
        </button>
      </template>

      <button
        type="button"
        class="btn-ghost px-1.5 py-1"
        :title="state.minimized ? $t('debug.expand') : $t('debug.minimize')"
        @click="state.minimized = !state.minimized"
      >
        <span
          :class="state.minimized ? 'i-lucide-maximize-2' : 'i-lucide-minimize-2'"
          class="inline-block"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="btn-ghost px-1.5 py-1"
        :title="$t('debug.off')"
        @click="enabled = false"
      >
        <span class="i-lucide-x inline-block" aria-hidden="true" />
      </button>
    </header>

    <div
      v-if="!state.minimized"
      ref="list"
      class="flex-1 overflow-auto px-2 py-1 font-mono text-xs leading-relaxed"
      role="log"
      aria-live="off"
      @scroll="onScroll"
    >
      <p v-if="!visible.length" class="py-2 text-muted">{{ $t('debug.empty') }}</p>
      <div
        v-for="entry in visible"
        :key="entry.id"
        class="flex gap-2 whitespace-pre-wrap break-all"
      >
        <button
          type="button"
          class="shrink-0 cursor-copy rounded px-0.5 hover:bg-fg/10"
          :class="copiedLine === entry.id ? 'text-success' : 'text-muted'"
          :title="$t('debug.copyLine')"
          @click="copyLine(entry)"
        >
          {{ clock(entry.time) }}
        </button>
        <span class="shrink-0" :class="entry.dir === 'in' ? 'text-muted' : 'text-success'">
          {{ entry.dir === 'in' ? '←' : '→' }}
        </span>
        <span :class="lineColor(entry)">{{ entry.text }}</span>
      </div>
    </div>
  </section>
</template>

<script lang="ts" setup>
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useDraggable, useEventListener, useLocalStorage, useResizeObserver } from '@vueuse/core'
import { useDebugLog, type LogEntry } from '@/composables/debugLog.ts'

const { enabled, entries, clear, asText } = useDebugLog()

const panel = useTemplateRef('panel')
const handle = useTemplateRef('handle')
const list = useTemplateRef('list')

// Where the panel sits, its size and whether it is folded to a bar; survives a reload
const MARGIN = 16
const state = useLocalStorage('debug-panel', {
  x: -1, // -1: not placed yet, bottom right on first open
  y: -1,
  width: 560,
  height: 320,
  minimized: false,
})

function clamp() {
  const width = Math.min(state.value.width, window.innerWidth - 2 * MARGIN)
  if (state.value.x < 0) state.value.x = window.innerWidth - width - MARGIN
  if (state.value.y < 0) state.value.y = window.innerHeight - state.value.height - MARGIN
  // Keep the bar on screen, so the panel can always be grabbed again
  state.value.x = Math.max(0, Math.min(state.value.x, window.innerWidth - 120))
  state.value.y = Math.max(0, Math.min(state.value.y, window.innerHeight - 40))
}
clamp()
useEventListener(window, 'resize', clamp)

const { x, y } = useDraggable(panel, {
  handle,
  initialValue: { x: state.value.x, y: state.value.y },
  // A press on a button or the filter is a click, not the start of a drag
  onStart: (_, e) => ((e.target as HTMLElement).closest('button, select') ? false : undefined),
  onEnd: (position) => {
    state.value.x = position.x
    state.value.y = position.y
    clamp()
    x.value = state.value.x
    y.value = state.value.y
  },
})

// Size from the native resize handle (bottom right corner)
useResizeObserver(panel, ([entry]) => {
  if (!entry || state.value.minimized) return
  const box = entry.target as HTMLElement
  state.value.width = box.offsetWidth
  state.value.height = box.offsetHeight
})

const panelStyle = computed(() => ({
  left: `${x.value}px`,
  top: `${y.value}px`,
  width: state.value.minimized ? 'auto' : `${state.value.width}px`,
  height: state.value.minimized ? 'auto' : `${state.value.height}px`,
  maxWidth: `calc(100vw - ${2 * MARGIN}px)`,
  maxHeight: `calc(100vh - ${2 * MARGIN}px)`,
  minWidth: '16rem',
  minHeight: state.value.minimized ? undefined : '8rem',
}))

// Filter: device answers and events (JSON) or the device's own log lines
const filter = ref<'all' | 'json' | 'log'>('all')
const visible = computed(() =>
  entries.value.filter((e) =>
    filter.value === 'all' ? true : filter.value === 'log' ? e.kind === 'log' : e.kind !== 'log',
  ),
)

// Full class names, so UnoCSS can find them
function lineColor(entry: LogEntry) {
  if (entry.kind === 'event') return 'text-primary'
  if (entry.kind === 'command') return 'text-success'
  if (entry.level === 'E') return 'text-danger'
  if (entry.level === 'W') return 'text-primary'
  if (entry.kind === 'log') return 'text-muted'
  return 'text-fg'
}

function clock(time: number) {
  const date = new Date(time)
  return `${date.toTimeString().slice(0, 8)}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

// Follow new lines; scrolling up pauses it, scrolling back to the end resumes
const autoScroll = ref(true)

function scrollToEnd() {
  list.value?.scrollTo({ top: list.value.scrollHeight })
}

// New lines: follow only while at the end
watch(
  visible,
  async () => {
    if (!autoScroll.value) return
    await nextTick()
    scrollToEnd()
  },
  { flush: 'post' },
)

// Opened, expanded or reloaded: always start at the newest line
watch(
  [enabled, () => state.value.minimized],
  async ([isOn, minimized]) => {
    if (!isOn || minimized) return
    autoScroll.value = true
    await nextTick()
    scrollToEnd()
  },
  { immediate: true, flush: 'post' },
)

function onScroll() {
  const el = list.value
  if (!el) return
  autoScroll.value = el.scrollHeight - el.scrollTop - el.clientHeight < 8
}

const copied = ref(false)
// Click on a line's time copies just that line
const copiedLine = ref<number>()
async function copyLine(entry: LogEntry) {
  await navigator.clipboard.writeText(asText([entry]))
  copiedLine.value = entry.id
  setTimeout(() => {
    if (copiedLine.value === entry.id) copiedLine.value = undefined
  }, 1500)
}

async function copy() {
  await navigator.clipboard.writeText(asText(visible.value))
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

function save() {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([asText(visible.value)], { type: 'text/plain' }))
  link.download = `clausage-log-${stamp}.txt`
  link.click()
  URL.revokeObjectURL(link.href)
}
</script>
