import { beforeEach, describe, expect, it } from 'vitest'
import { recordLine, useDebugLog } from '@/composables/debugLog.ts'

const log = useDebugLog()

describe('debug log', () => {
  beforeEach(() => {
    log.enabled.value = true
    log.clear()
  })

  it('records nothing while switched off', () => {
    log.enabled.value = false
    recordLine('in', 'I (10) boot: hello')
    expect(log.entries.value).toHaveLength(0)
  })

  it('never keeps the token or the Wi-Fi password of a command', () => {
    recordLine('out', '{"id":5,"cmd":"token.set","token":"sk-ant-oat01-secret"}')
    recordLine('out', '{"id":6,"cmd":"wifi.set","ssid":"HomeNet","password":"hunter2"}')

    const text = log.asText()
    expect(text).not.toContain('sk-ant-oat01-secret')
    expect(text).not.toContain('hunter2')
    expect(text).toContain('"ssid":"HomeNet"') // everything else stays as sent
  })

  it('strips the ESP-IDF color codes and reads the log level', () => {
    recordLine('in', '\x1b[0;33mW (5321) wifi: retrying\x1b[0m')

    expect(log.entries.value[0]).toMatchObject({
      kind: 'log',
      level: 'W',
      text: 'W (5321) wifi: retrying',
    })
  })

  it('tells replies, events and commands apart', () => {
    recordLine('in', '{"id":1,"ok":true}')
    recordLine('in', '{"event":"wifi","state":"connected"}')
    recordLine('out', '{"id":2,"cmd":"info"}')

    expect(log.entries.value.map((e) => e.kind)).toEqual(['reply', 'event', 'command'])
  })

  it('keeps only the last 500 lines', () => {
    for (let i = 1; i <= 510; i++) recordLine('in', `I (${i}) test: line ${i}`)

    expect(log.entries.value).toHaveLength(500)
    expect(log.entries.value[0]!.text).toContain('line 11')
    expect(log.entries.value[499]!.text).toContain('line 510')
  })
})
