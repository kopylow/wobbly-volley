import { expect, test } from 'claude-code/testing'

import { AiSource, MEDIUM } from '../core/ai'
import { PALETTE, draw } from '../core/draw'
import type { Frame } from '../core/draw'
import { MAX_COLORED_RUNS, encodeRuns } from '../core/encode'
import type { Run } from '../core/encode'
import { dispatch, newGame, newMatch, tick } from '../core/game'

const COLORS = [null, '#000001', '#000002', '#000003', '#000004', '#000005']

/** A frame from rows of pixel indices, two strings per terminal row ('.' is the sky). */
function frame(lines: string[]): Frame {
  const w = lines[0]?.length ?? 0
  const px = new Uint8Array(w * lines.length)
  lines.forEach((line, y) => {
    for (let x = 0; x < w; x++) px[y * w + x] = line[x] === '.' ? 0 : Number(line[x])
  })

  return { w, h: lines.length, px, overlays: [] }
}

const cells = (row: Run[]) => row.reduce((n, run) => n + run.text.length, 0)

test('encode: the sky is plain blanks with no colour', () => {
  expect(encodeRuns(frame(['....', '....', '....', '....']), COLORS)).toEqual([[{ text: '    ' }], [{ text: '    ' }]])
})

test('encode: two pixels a cell as half blocks, the upper one in front', () => {
  expect(encodeRuns(frame(['1.34', '.235']), COLORS)).toEqual([
    [
      { text: '▀', fg: '#000001' },
      { text: '▄', fg: '#000002' },
      { text: '█', fg: '#000003' },
      { text: '▀', fg: '#000004', bg: '#000005' },
    ],
  ])
})

test('encode: neighbours of one colour pair merge into one run', () => {
  expect(encodeRuns(frame(['1111..2', '1.1...2']), COLORS)).toEqual([
    [{ text: '█▀█▀', fg: '#000001' }, { text: '  ' }, { text: '█', fg: '#000002' }],
  ])
})

test('encode: overlays replace cells in their row, cut at the right edge', () => {
  const f = frame(['..........', '..........', '1111111111', '1111111111'])
  f.overlays.push({ row: 1, col: 7, text: 'abcde', color: 4 })
  f.overlays.push({ row: 0, col: -2, text: 'xyz', color: 3 })
  expect(encodeRuns(f, COLORS)).toEqual([
    [{ text: 'z', fg: '#000003' }, { text: '         ' }],
    [{ text: '███████', fg: '#000001' }, { text: 'abc', fg: '#000004' }],
  ])
})

test('encode: every row of real play covers the court exactly', () => {
  for (const w of [60, 110, 160]) {
    const game = newGame({ w, match: newMatch(), seed: 3 })
    const you = new AiSource(MEDIUM, 4)
    const claude = new AiSource(MEDIUM, 5)
    dispatch(game, { kind: 'start' })
    let colored = 0
    for (let i = 0; i < 6000; i++) {
      if (game.phase === 'idle') dispatch(game, { kind: 'start' })
      tick(game, { you: you.next(game, 'you'), claude: claude.next(game, 'claude') })
      if (i % 20 !== 0) continue
      const rows = encodeRuns(draw(game, { rows: 24, rival: 'Jelly' }), PALETTE)
      expect(rows).toHaveLength(24)
      for (const row of rows) expect(cells(row)).toBe(w)
      colored = Math.max(colored, rows.flat().filter(run => run.fg !== undefined).length)
    }
    // A real frame stays far below the guard (about 30 coloured runs, PLAN.md section 11).
    expect(colored).toBeLessThan(60)
  }
})

test("encode: a pulsing line's weight goes into runs of its own, the cells around it stay plain", () => {
  const f = frame(['..........', '..........', '1111111111', '1111111111'])
  f.overlays.push({ row: 0, col: 3, text: '3', color: 0, weight: 'bold' })
  f.overlays.push({ row: 1, col: 1, text: 'ab', color: 4, weight: 'dim' })
  expect(encodeRuns(f, COLORS)).toEqual([
    [{ text: '   ' }, { text: '3', weight: 'bold' }, { text: '      ' }],
    [{ text: '█', fg: '#000001' }, { text: 'ab', fg: '#000004', weight: 'dim' }, { text: '███████', fg: '#000001' }],
  ])
})

test('encode: a frame of all different cells stays within the Client bound', () => {
  const w = 160
  const h = 48
  const px = new Uint8Array(w * h)
  for (let i = 0; i < px.length; i++) px[i] = 1 + ((i * 7 + Math.floor(i / w) * 3) % 8)
  const rows = encodeRuns({ w, h, px, overlays: [] }, PALETTE)

  const runs = rows.flat()
  expect(runs.filter(run => run.fg !== undefined)).toHaveLength(MAX_COLORED_RUNS)
  for (const row of rows) expect(cells(row)).toBe(w)
  // What the court serializes to (PLAN.md 5.1): a row Text 56 characters, a coloured run 57 or 85
  // with a background, a plain run 3, each plus its text.
  const size = rows.length * 56 + runs.reduce((n, run) => n + run.text.length + (run.fg ? (run.bg ? 85 : 57) : 3), 0)
  expect(size).toBeLessThan(90000)
})
