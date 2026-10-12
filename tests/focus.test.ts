import { expect, test } from 'claude-code/testing'

import { FocusWatch } from '../hooks/focus'

// The window's focus as the frame clock shows it (PLAN.md 6.8): about 16 ms gaps with the focus, a
// steady 32 to 33 without it, now and then a gap outside both (P1, P2).

/** Feeds the gaps and returns the indices of the ticks at which the window was found gone. */
function feed(watch: FocusWatch, gaps: number[]): number[] {
  const left: number[] = []
  gaps.forEach((gap, i) => {
    if (watch.gap(gap)) left.push(i)
  })

  return left
}

const repeat = (gap: number, n: number) => new Array<number>(n).fill(gap)

test('focus: the foreground clock never counts as left, stalls and slow stretches included', () => {
  const watch = new FocusWatch()
  // Single stalls of P1 and P2, and a busy stretch where gaps wander between 16 and 45 ms.
  const busy = Array.from({ length: 600 }, (_, i) => [16, 17, 45, 22, 16, 33, 18, 28, 16, 38][i % 10] ?? 16)
  // A loaded engine drawing a steady 50 or 22 frames a second is busy, not in the background.
  const gaps = [...repeat(16.7, 300), 112, ...repeat(16.7, 60), 175, 316, ...repeat(16.7, 60), ...busy, ...repeat(20, 100), ...repeat(45, 100)]

  expect(feed(watch, gaps)).toEqual([])
  expect(watch.background).toBe(false)
})

test('focus: the background rate counts as left once, within half a second', () => {
  const watch = new FocusWatch()
  // P1's background seconds: 32 ms with now and then a short or a long gap among them.
  const away = Array.from({ length: 200 }, (_, i) => (i % 25 === 7 ? 9.5 : i % 31 === 3 ? 54 : 32.5))
  const left = feed(watch, [...repeat(16.7, 120), ...away])

  expect(left).toHaveLength(1)
  // Ticks after the window left, at about 32 ms each.
  expect((left[0] ?? 0) - 120).toBeLessThanOrEqual(15)
  expect(watch.background).toBe(true)
})

test('focus: back in front clears it, and the next departure counts again', () => {
  const watch = new FocusWatch()
  const left = feed(watch, [...repeat(16.7, 60), ...repeat(32.5, 40), ...repeat(16.7, 30), ...repeat(32.5, 40)])

  expect(left).toHaveLength(2)
  expect(left[1]).toBeGreaterThan(130)
})

test('focus: a click on the way back finds it still away, and no second pause follows', () => {
  const watch = new FocusWatch()
  feed(watch, [...repeat(16.7, 60), ...repeat(32.5, 40)])
  // The first fast ticks after the return keep the verdict until fast ones dominate.
  expect(feed(watch, repeat(16.7, 8))).toEqual([])
  expect(watch.background).toBe(true)
  expect(feed(watch, repeat(16.7, 8))).toEqual([])
  expect(watch.background).toBe(false)
})
