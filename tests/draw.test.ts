import { expect, test } from 'claude-code/testing'

import { EASY, HARD, MEDIUM } from '../core/ai'
import { BEAT_STEPS, COUNTDOWN_STEPS, HOP_PX, HOP_STEPS, MATCH_END_STEPS, NET_R, WOBBLE_STEPS } from '../core/constants'
import { SIDES, blobRange, homeX } from '../core/sim'
import {
  BALL,
  BLOB_COLOR,
  BLOB_SHADE,
  BLOB_SHINE,
  EYE,
  GROUND,
  GROUND_TOP,
  NET,
  PALETTE,
  PUPIL,
  SKY,
  courtSize,
  draw,
  groundPx,
  messageRow,
  pulse,
} from '../core/draw'
import type { Frame } from '../core/draw'
import { dispatch, newGame, newMatch } from '../core/game'
import type { Game, Side } from '../core/types'

function serve(w: number): Game {
  return newGame({ w, match: newMatch(), seed: 1 })
}

/** The win screen at its first step, the match won `you` to `claude`, the last ball on the ground. */
function won(w: number, you: number, claude: number): Game {
  const g = serve(w)
  Object.assign(g, { phase: 'matchEnd', timer: MATCH_END_STEPS, lastMatch: { winner: you > claude ? 'you' : 'claude', you, claude } })
  Object.assign(g.sim.ball, { x: w * 0.9, y: 3, hover: false })

  return g
}



/** The pixel at a world column and world row (0 just above the ground) of a frame drawn at `rows`. */
function at(frame: Frame, col: number, row: number): number | undefined {
  const air = frame.h - groundPx(frame.h / 2)
  const y = air - 1 - row

  return frame.px[y * frame.w + col]
}

function count(frame: Frame, color: number): number {
  return frame.px.filter(p => p === color).length
}

/**
 * A side's blob around column `col`, ten world rows from row 9 down to the feet: `o` body, `l` shine,
 * `d` shade, `e` eye, `p` pupil, `.` sky and `?` anything else.
 */
function picture(frame: Frame, side: Side, col: number): string[] {
  const tones = new Map([
    [BLOB_COLOR[side], 'o'],
    [BLOB_SHINE[side], 'l'],
    [BLOB_SHADE[side], 'd'],
    [EYE, 'e'],
    [PUPIL, 'p'],
    [SKY, '.'],
  ])
  const lines: string[] = []
  for (let row = 9; row >= 0; row--) {
    let line = ''
    for (let x = col - 5; x < col + 5; x++) line += tones.get(at(frame, x, row) ?? SKY) ?? '?'
    lines.push(line)
  }

  return lines
}

/** The columns a colour covers in each world row it shows in, from the bottom up. */
function widths(frame: Frame, color: number): number[] {
  const rows: number[] = []
  for (let y = frame.h - 1; y >= 0; y--) {
    let n = 0
    for (let x = 0; x < frame.w; x++) if (frame.px[y * frame.w + x] === color) n++
    if (n > 0) rows.push(n)
  }

  return rows
}

test('draw: the court takes the band within 60 to 160 columns and 16 to 24 rows', () => {
  expect(courtSize(110, 29)).toEqual({ columns: 110, rows: 24 })
  expect(courtSize(200, 29)).toEqual({ columns: 160, rows: 24 })
  expect(courtSize(60, 29)).toEqual({ columns: 60, rows: 24 })
  expect(courtSize(110, 20)).toEqual({ columns: 110, rows: 18 })
  expect(courtSize(110, 18)).toEqual({ columns: 110, rows: 16 })
  expect(courtSize(110, 17)).toBe('taller')
  expect(courtSize(110, 0)).toBe('taller')
  expect(courtSize(59, 29)).toBe('wider')
  // The Client measures its own region the same way: the band's answer comes back.
  expect(courtSize(110, 26)).toEqual({ columns: 110, rows: 24 })
  expect(courtSize(110, 1)).toBe('taller')
})

test('draw: 4 px of ground, 2 on a court too short to show the hovering serve above 4', () => {
  expect(groundPx(24)).toBe(4)
  expect(groundPx(17)).toBe(4)
  expect(groundPx(16)).toBe(2)

  const frame = draw(serve(60), { rows: 24, rival: 'Jelly' })
  expect([frame.w, frame.h]).toEqual([60, 48])
  for (let x = 0; x < 60; x++) {
    expect([frame.px[44 * 60 + x], frame.px[45 * 60 + x], frame.px[47 * 60 + x]]).toEqual([GROUND_TOP, GROUND, GROUND])
  }

  const short = draw(serve(60), { rows: 16, rival: 'Jelly' })
  expect([short.px[30 * 60], short.px[31 * 60], short.px[29 * 60]]).toEqual([GROUND_TOP, GROUND, SKY])
})

test('draw: the net is two columns wide and 17 px high in the middle', () => {
  const frame = draw(serve(60), { rows: 24, rival: 'Jelly' })
  for (let row = 0; row < 17; row++) expect([at(frame, 29, row), at(frame, 30, row)]).toEqual([NET, NET])
  expect([at(frame, 29, 17), at(frame, 28, 0), at(frame, 31, 0)]).toEqual([SKY, SKY, SKY])
  expect(count(frame, NET)).toBe(34)

  // At an odd width the middle falls inside a column: still two columns, half a pixel to the left.
  for (const w of [61, 111]) expect(count(draw(serve(w), { rows: 24, rival: 'Jelly' }), NET)).toBe(34)
})

test('draw: blobs are round jelly 8 wide with a shine and a shade, their eyes on the ball', () => {
  const g = serve(60)
  // A ball high on Claude's side, between the blobs' eyes: both look toward the net.
  Object.assign(g.sim.ball, { x: 40, y: 40, hover: false })
  const frame = draw(g, { rows: 24, rival: 'Jelly' })
  // From the feet up: a sole in the shade, BLOB_W wide with the shade in front, the head as narrow
  // as the upper circle, the shine at its back.
  const you = [
    '..........',
    '...oooo...',
    '..oloooo..',
    '..oloepo..',
    '.oooooood.',
    '.oooooood.',
    '.oooooood.',
    '.oooooood.',
    '.oooooood.',
    '..dddddd..',
  ]
  expect(picture(frame, 'you', homeX(60, 'you'))).toEqual(you)
  expect(picture(frame, 'claude', homeX(60, 'claude'))).toEqual(you.map(line => [...line].reverse().join('')))
})

test("draw: each eye takes the ball's side, both blobs, every frame, a ball in view and above it", () => {
  for (const wobble of [0, 3, WOBBLE_STEPS / 2]) {
    for (const [x, y] of [
      [3, 30],
      [57, 30],
      [3, 80],
      [57, 80],
    ] as const) {
      const g = serve(60)
      for (const side of SIDES) g.sim.blobs[side].wobble = wobble
      Object.assign(g.sim.ball, { x, y, hover: false })
      const frame = draw(g, { rows: 24, rival: 'Jelly' })
      for (const side of SIDES) {
        const lines = picture(frame, side, homeX(60, side))
        // One pupil, beside the white of the eye on the ball's side.
        expect(lines.join('').split('p')).toHaveLength(2)
        expect(lines.find(line => line.includes('p'))).toContain(x < 30 ? 'pe' : 'ep')
      }
    }
  }
})

test("draw: each blob's shine is a lighter and its shade a darker tone of its own colour", () => {
  const rgb = (index: number): number[] => [1, 3, 5].map(i => Number.parseInt((PALETTE[index] ?? '').slice(i, i + 2), 16))
  const light = (index: number): number => rgb(index).reduce((a, b) => a + b, 0)
  // Blue stays strongest in every tone of yours, red in every tone of Claude's.
  const strongest = (index: number): number => rgb(index).indexOf(Math.max(...rgb(index)))
  for (const side of SIDES) {
    const [body, shine, shade] = [BLOB_COLOR[side], BLOB_SHINE[side], BLOB_SHADE[side]]
    expect(light(shine)).toBeGreaterThan(light(body))
    expect(light(shade)).toBeLessThan(light(body))
    expect([strongest(shine), strongest(shade)]).toEqual([strongest(body), strongest(body)])
  }
})

test('draw: a wobble squashes the blob flatter and wider on the same feet, and back', () => {
  const g = serve(60)
  Object.assign(g.sim.ball, { x: 40, y: 40, hover: false })
  const col = homeX(60, 'you')
  const heights = Array.from({ length: WOBBLE_STEPS }, (_, wobble) => {
    g.sim.blobs.you.wobble = wobble
    return picture(draw(g, { rows: 24, rival: 'Jelly' }), 'you', col).filter(line => line !== '..........').length
  })
  expect(heights).toEqual([9, 9, 8, 8, 8, 8, 7, 7, 7, 7, 7, 8, 8, 8, 8, 9])

  g.sim.blobs.you.wobble = WOBBLE_STEPS / 2
  expect(picture(draw(g, { rows: 24, rival: 'Jelly' }), 'you', col)).toEqual([
    '..........',
    '..........',
    '..........',
    '...oooo...',
    '..oloooo..',
    '.oloooepo.',
    'oooooooood',
    'oooooooood',
    'oooooooood',
    '.dddddddd.',
  ])
})

test('draw: a blob stands flush at the net, and the net hides what a wobble squashes past it', () => {
  const g = serve(60)
  g.sim.blobs.you.x = blobRange(60, 'you').max
  // The net's first column.
  const net = Math.ceil(30 - NET_R - 0.5)
  const still = draw(g, { rows: 24, rival: 'Jelly' })
  expect([at(still, net - 1, 1), at(still, net, 1)]).toEqual([BLOB_SHADE.you, NET])

  g.sim.blobs.you.wobble = WOBBLE_STEPS / 2
  const frame = draw(g, { rows: 24, rival: 'Jelly' })
  expect([at(frame, net - 1, 1), at(frame, net, 1)]).toEqual([BLOB_COLOR.you, NET])
  expect(count(frame, NET)).toBe(34)
})

test('draw: the hovering serve is a round disc of 37 px, whole on every court height', () => {
  for (const rows of [24, 16]) {
    const g = serve(60)
    const frame = draw(g, { rows, rival: 'Jelly' })
    expect(count(frame, BALL)).toBe(37)
    expect(widths(frame, BALL)).toEqual([3, 5, 7, 7, 7, 5, 3])
    expect(at(frame, Math.floor(g.sim.ball.x), Math.floor(g.sim.ball.y))).toBe(BALL)
  }
})

test('draw: a ball wholly above the view leaves an arrow at its column', () => {
  const g = serve(60)
  Object.assign(g.sim.ball, { x: 40.5, y: 60, hover: false })
  const frame = draw(g, { rows: 24, rival: 'Jelly' })
  expect(count(frame, BALL)).toBe(4)
  expect(frame.px[40]).toBe(BALL)
  expect([frame.px[60 + 39], frame.px[60 + 40], frame.px[60 + 41]]).toEqual([BALL, BALL, BALL])
  expect([frame.px[39], frame.px[41]]).toEqual([SKY, SKY])
})

test('draw: a ball partly above the view shows its lower part and no arrow', () => {
  const g = serve(60)
  // Its lowest pixel row is the view's top row.
  Object.assign(g.sim.ball, { x: 40.5, y: 46.5, hover: false })
  const frame = draw(g, { rows: 24, rival: 'Jelly' })
  expect([frame.px[39], frame.px[40], frame.px[41]]).toEqual([BALL, BALL, BALL])
  expect(count(frame, BALL)).toBe(3)
  expect(frame.px[60 + 40]).toBe(SKY)
})

test('draw: blobs at the walls and at the top of a jump are drawn whole, nothing wraps', () => {
  const full = count(draw(serve(60), { rows: 24, rival: 'Jelly' }), BLOB_COLOR.you)
  for (const w of [60, 110, 160]) {
    const g = serve(w)
    g.sim.blobs.you.x = blobRange(w, 'you').min
    g.sim.blobs.claude.x = blobRange(w, 'claude').max
    g.sim.blobs.claude.y = 23.2
    const frame = draw(g, { rows: 24, rival: 'Jelly' })
    expect([count(frame, BLOB_COLOR.you), count(frame, BLOB_COLOR.claude)]).toEqual([full, full])
    // Nothing of a blob at the left wall shows at the right edge, or the other way round.
    for (let y = 0; y < frame.h; y++) {
      expect(frame.px[y * w + w - 1]).not.toBe(BLOB_COLOR.you)
      expect(frame.px[y * w]).not.toBe(BLOB_COLOR.claude)
    }
  }
})

test('draw: the phase message lies in the sky, clear of the hovering serve and the net, on every court', () => {
  for (const w of [60, 110, 160]) {
    for (const rows of [16, 20, 24]) {
      for (const server of ['you', 'claude'] as const) {
        // Waiting for the click: "Click to play" over the serve.
        const game = newGame({ w, match: { ...newMatch(), server }, seed: 1 })
        const frame = draw(game, { rows, rival: 'Jelly' })
        expect(frame.overlays).toHaveLength(1)
        const [message] = frame.overlays
        if (message === undefined) continue
        expect(message.row).toBe(messageRow(rows))
        expect(message.color).toBe(SKY)
        for (const y of [2 * message.row, 2 * message.row + 1]) {
          for (let x = message.col; x < message.col + message.text.length; x++) expect(frame.px[y * w + x]).toBe(SKY)
        }
      }
    }
  }
  // Play itself carries no message.
  const game = serve(110)
  dispatch(game, { kind: 'start' })
  game.phase = 'rally'
  expect(draw(game, { rows: 24, rival: 'Jelly' }).overlays).toEqual([])
})

test('draw: a pulse lights up for a third of the beat, stays plain for a third, fades for a third', () => {
  const weights = Array.from({ length: 2 * BEAT_STEPS }, (_, step) => pulse(step) ?? 'plain')
  const third = BEAT_STEPS / 3
  const one = [...Array<string>(third).fill('bold'), ...Array<string>(third).fill('plain'), ...Array<string>(third).fill('dim')]
  expect(weights).toEqual([...one, ...one])
})

/** A phase's message lines step by step, each with its weight, in the order they come; and how many steps each held. */
function lines(game: Game, steps: number, at: (step: number) => void): { order: string[]; held: number[] } {
  const order: string[] = []
  const held: number[] = []
  const odd: string[] = []
  for (let step = 0; step < steps; step++) {
    at(step)
    const overlays = draw(game, { rows: 24, rival: 'Jelly' }).overlays
    const [o] = overlays
    if (overlays.length !== 1 || o?.row !== messageRow(24) || o.color !== SKY) odd.push(JSON.stringify(overlays))
    const line = `${o?.text} ${o?.weight ?? 'plain'}`
    if (order[order.length - 1] === line) held[held.length - 1]! += 1
    else {
      order.push(line)
      held.push(1)
    }
  }
  expect(odd).toEqual([])

  return { order, held }
}

test('draw: the countdown is the message line, each digit lighting up and fading over its beat', () => {
  const g = serve(110)
  dispatch(g, { kind: 'start' })
  const { order, held } = lines(g, COUNTDOWN_STEPS, step => (g.timer = COUNTDOWN_STEPS - step))
  expect(order).toEqual(['3 bold', '3 plain', '3 dim', '2 bold', '2 plain', '2 dim', '1 bold', '1 plain', '1 dim'])
  expect(held).toEqual(Array<number>(9).fill(BEAT_STEPS / 3))
})

test('draw: the win screen is the message line with the final score, pulsing with every hop', () => {
  for (const [you, claude, text] of [
    [11, 7, 'You win 11 : 7'],
    [9, 11, 'Jelly wins 9 : 11'],
  ] as const) {
    const g = won(110, you, claude)
    const { order } = lines(g, MATCH_END_STEPS, step => (g.timer = MATCH_END_STEPS - step))
    const one = [`${text} bold`, `${text} plain`, `${text} dim`]
    expect(order).toEqual(Array.from({ length: MATCH_END_STEPS / BEAT_STEPS }, () => one).flat())
  }
})

test("draw: the AI's point and its win name it as the view says, each level by its own name", () => {
  expect([EASY, MEDIUM, HARD].map(level => level.player)).toEqual(['Pudding', 'Jelly', 'Gummy'])
  const said: string[] = []
  for (const { player } of [EASY, MEDIUM, HARD]) {
    const g = won(110, 9, 11)
    said.push(draw(g, { rows: 24, rival: player }).overlays[0]?.text ?? '')
    Object.assign(g, { phase: 'point', timer: 30, lastPoint: 'claude' })
    said.push(draw(g, { rows: 24, rival: player }).overlays[0]?.text ?? '')
  }
  expect(said).toEqual(['Pudding wins 9 : 11', 'Point for Pudding', 'Jelly wins 9 : 11', 'Point for Jelly', 'Gummy wins 9 : 11', 'Point for Gummy'])
})

test('draw: the other messages stay still', () => {
  const g = serve(110)
  const still = () => draw(g, { rows: 24, rival: 'Jelly' }).overlays.map(o => o.weight)
  expect(still()).toEqual([undefined])
  g.phase = 'paused'
  expect(still()).toEqual([undefined])
  Object.assign(g, { phase: 'point', timer: 30, lastPoint: 'you' })
  expect(still()).toEqual([undefined])
})

test('draw: on the win screen the winner hops below the message and the loser lies flat; the game stays as it was', () => {
  for (const [you, claude] of [
    [11, 7],
    [9, 11],
  ] as const) {
    const g = won(110, you, claude)
    const winner: Side = you > claude ? 'you' : 'claude'
    const loser: Side = winner === 'you' ? 'claude' : 'you'
    // The blobs' floored columns: home lies between two at this width.
    const [hopper, lying] = [Math.floor(homeX(110, winner)), Math.floor(homeX(110, loser))]
    const feet: number[] = []
    const heights = new Set<number>()
    for (let t = 0; t < MATCH_END_STEPS; t++) {
      g.timer = MATCH_END_STEPS - t
      const before = structuredClone(g)
      const frame = draw(g, { rows: 16, rival: 'Jelly' })
      expect(g).toEqual(before)

      // The winner's lowest row, the hop's height; its rows drawn, 9 standing, 7 when flat.
      let low = Infinity
      let high = -Infinity
      for (let row = 0; row < 30; row++) {
        for (let x = hopper - 5; x < hopper + 5; x++) {
          const c = at(frame, x, row)
          if (c === BLOB_COLOR[winner] || c === BLOB_SHADE[winner]) {
            low = Math.min(low, row)
            high = Math.max(high, row)
          }
        }
      }
      feet.push(low)
      heights.add(high - low + 1)
      expect(picture(frame, loser, lying).filter(line => line !== '..........')).toHaveLength(7)
    }
    // One hop every HOP_STEPS: up to HOP_PX and back to the ground, the top below the message line,
    // whose lower pixel row is world row air - 2 - 2 * its cell row.
    expect(Math.max(...feet)).toBe(HOP_PX)
    expect(Math.max(...feet) + 8).toBeLessThan(2 * 16 - groundPx(16) - 2 - 2 * messageRow(16))
    expect(feet.filter((row, t) => row > 0 && (feet[t - 1] ?? 0) === 0)).toHaveLength(MATCH_END_STEPS / HOP_STEPS)
    expect([...heights].sort()).toEqual([7, 8, 9])
  }
})
