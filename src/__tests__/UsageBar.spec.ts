import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import UsageBar from '@/components/home/UsageBar.vue'
import type { UsageWindow } from '@/composables/device.ts'

const now = new Date('2026-09-27T10:00:00').getTime()
const inMinutes = (minutes: number) => (now + minutes * 60000) / 1000

function bar(window: Partial<UsageWindow>) {
  const w = mount(UsageBar, {
    props: {
      label: '5-hour limit',
      kind: 'five_hour',
      now,
      window: { percent: 0, resets_at: inMinutes(83), ...window },
    },
  })
  return {
    percent: w.find('[role=progressbar]').attributes('aria-valuenow'),
    color: w
      .find('[role=progressbar] div')
      .classes()
      .find((c) => c.startsWith('bg-')),
    badge: w.find('.rounded-full.px-2'),
    text: w.text(),
  }
}

describe('usage bar', () => {
  // Same thresholds as the display: olive, orange from 80 %, red from 95 %
  it.each([
    [79, 'bg-success'],
    [80, 'bg-primary'],
    [94, 'bg-primary'],
    [95, 'bg-danger'],
  ])('%i %% is %s', (percent, color) => {
    expect(bar({ percent }).color).toBe(color)
  })

  it('shows a countdown to the reset', () => {
    expect(bar({ percent: 42 }).text).toContain('1:23 h')
  })

  it('shows 0 % and "new window" once the reset time has passed', () => {
    const expired = bar({ percent: 97, resets_at: inMinutes(-1), forecast: 'too_fast' })

    expect(expired.percent).toBe('0')
    expect(expired.color).toBe('bg-success')
    expect(expired.text).toContain('New window started')
    expect(expired.badge.exists()).toBe(false) // no forecast for a window that is over
  })

  it('shows the forecast badge, with the time the limit is reached when too fast', () => {
    expect(bar({ percent: 30, forecast: 'on_track' }).badge.text()).toBe('On track')

    const tooFast = bar({ percent: 62, forecast: 'too_fast', limit_at: inMinutes(30) })
    expect(tooFast.badge.text()).toMatch(/^Too fast · limit /)
    expect(tooFast.badge.classes()).toContain('text-danger')
  })

  it('shows no badge while the forecast is unknown', () => {
    expect(bar({ percent: 5, forecast: 'unknown' }).badge.exists()).toBe(false)
  })
})
