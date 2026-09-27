import { readonly, shallowRef, triggerRef } from 'vue'
import { useLocalStorage } from '@vueuse/core'

// Replaces `idf monitor` while the web app holds the port: every line in and out, kept in memory.
// Switched on and off with the header button; stored, so it survives a reload.

const MAX_ENTRIES = 500

export type LogKind = 'reply' | 'event' | 'log' | 'command'

export interface LogEntry {
  id: number
  time: number // Date.now()
  dir: 'in' | 'out'
  kind: LogKind
  level?: 'E' | 'W' | 'I' | 'D' | 'V' // ESP-IDF log level of a device log line
  text: string
}

const enabled = useLocalStorage('serial-debug', false)
const entries = shallowRef<LogEntry[]>([]) // shallow: 500 lines, replaced as a whole
let nextId = 1

// Secrets never end up in the log (it may be copied into a bug report)
const SECRET_FIELDS = ['token', 'password']

function maskSecrets(text: string) {
  try {
    const command = JSON.parse(text) as Record<string, unknown>
    for (const field of SECRET_FIELDS) if (field in command) command[field] = '•••'
    return JSON.stringify(command)
  } catch {
    return text
  }
}

function classify(dir: LogEntry['dir'], text: string): Pick<LogEntry, 'kind' | 'level'> {
  if (dir === 'out') return { kind: 'command' }
  if (text.startsWith('{')) return { kind: text.includes('"event"') ? 'event' : 'reply' }
  // ESP-IDF: "W (1234) wifi: ..."
  const level = /^([EWIDV]) \(\d+\)/.exec(text)?.[1] as LogEntry['level']
  return { kind: 'log', level }
}

// Called by serial.ts for every line; costs nothing while the debugger is off
export function recordLine(dir: LogEntry['dir'], line: string) {
  if (!enabled.value) return
  // ESP-IDF colors its logs with ANSI codes; they would show up as garbage
  // oxlint-disable-next-line no-control-regex
  const text = line.replace(/\x1b\[[0-9;]*m/g, '').trimEnd()
  if (!text) return

  const entry: LogEntry = {
    id: nextId++,
    time: Date.now(),
    dir,
    text: dir === 'out' ? maskSecrets(text) : text,
    ...classify(dir, text),
  }
  const list = entries.value
  list.push(entry)
  if (list.length > MAX_ENTRIES) list.splice(0, list.length - MAX_ENTRIES)
  triggerRef(entries)
}

export function useDebugLog() {
  function clear() {
    entries.value = []
  }

  // Plain text, e.g. for a bug report: "10:42:01.123 ← I (1234) wifi: connected"
  function asText(list: readonly LogEntry[] = entries.value) {
    return list
      .map((e) => {
        const time = new Date(e.time).toTimeString().slice(0, 8)
        const ms = String(e.time % 1000).padStart(3, '0')
        return `${time}.${ms} ${e.dir === 'in' ? '←' : '→'} ${e.text}`
      })
      .join('\n')
  }

  return { enabled, entries: readonly(entries), clear, asText }
}
