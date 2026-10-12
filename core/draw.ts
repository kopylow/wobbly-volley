import {
  BALL_R,
  BEAT_STEPS,
  COURT_ROWS,
  GROUND_PX,
  HOP_PX,
  HOP_STEPS,
  MATCH_END_STEPS,
  MAX_W,
  MIN_COURT_ROWS,
  MIN_W,
  NET_H,
  NET_R,
  SERVE_Y,
  TEXT_ROWS,
  WOBBLE_STEPS,
} from './constants'
import { SIDES } from './sim'
import type { Game, Side } from './types'

// Game to picture (PLAN.md 6.7): a frame of palette indices, one entry per world pixel, two pixel
// rows to a terminal row, plus text laid over the court's cells. encode.ts turns it into output.

/** The colours of PLAN.md 3.2 by index. Index 0 is the sky: the terminal's own background. */
export const PALETTE: readonly (string | null)[] = [
  null,
  '#3f6b4a',
  '#5f9a6a',
  '#d0d0d0',
  '#f2f2f2',
  '#4aa3ff',
  '#d97757',
  '#ffffff',
  '#202020',
  '#a5d4ff',
  '#f2b39b',
  '#2f7fd6',
  '#b45a3d',
]
export const SKY = 0
export const GROUND = 1
export const GROUND_TOP = 2
export const NET = 3
export const BALL = 4
export const BLOB_COLOR: Record<Side, number> = { you: 5, claude: 6 }
export const EYE = 7
export const PUPIL = 8
/** A blob's shine, lighter than its body, and its shade, darker. */
export const BLOB_SHINE: Record<Side, number> = { you: 9, claude: 10 }
export const BLOB_SHADE: Record<Side, number> = { you: 11, claude: 12 }

/** How a pulsing line is drawn at a moment: bright or faint; plain sets neither. */
export type Weight = 'bold' | 'dim'

/** Text over the court: `row` and `col` in cells, `color` a palette index, `weight` for a pulsing line. */
export type Overlay = { row: number; col: number; text: string; color: number; weight?: Weight }

/** `w` by `h` pixels, row 0 at the top; `h` is twice the court's rows. */
export type Frame = { w: number; h: number; px: Uint8Array; overlays: Overlay[] }

/** What the court is drawn for: its rows, and the name the AI plays under (its level's `player`). */
export type View = { rows: number; rival: string }

export type CourtSize = { columns: number; rows: number }

/**
 * The court in a room of `columns` by `rows` (the band's, or the Client's own region): its width and
 * its rows less the score and hint rows, or what the room lacks for one.
 */
export function courtSize(columns: number, rows: number): CourtSize | 'wider' | 'taller' {
  if (columns < MIN_W) return 'wider'
  const court = Math.min(COURT_ROWS, rows - TEXT_ROWS)
  if (court < MIN_COURT_ROWS) return 'taller'

  return { columns: Math.min(MAX_W, columns), rows: court }
}

/** The hovering serve's top pixel row is SERVE_Y + BALL_R; a court too short for it gets less ground. */
export function groundPx(rows: number): number {
  return 2 * rows - GROUND_PX > SERVE_Y + BALL_R ? GROUND_PX : GROUND_PX / 2
}

type Sprite = readonly { dx: number; dy: number }[]

/** A sprite that brings its own colours. */
type Painted = readonly { dx: number; dy: number; color: number }[]

/**
 * The blob facing right, top row first: at rest, then ever more squashed by its wobble, flatter and
 * wider on the same feet. `o` is the body, `l` its shine, `d` its shade and `e` the eye, two white
 * pixels; the pupil goes into the one on the ball's side (`draw`). The body is BLOB_W wide, so it
 * stands flush at the walls and the net, and the top keeps to the collision circles.
 */
const BLOB_ART: readonly (readonly string[])[] = [
  [
    '..oooo..',
    '.oloooo.',
    '.oloeeo.',
    'oooooood',
    'oooooood',
    'oooooood',
    'oooooood',
    'oooooood',
    '.dddddd.',
  ],
  [
    '..oooo..',
    '.oloooo.',
    '.oloeeo.',
    'oooooood',
    'oooooood',
    'oooooood',
    'oooooood',
    'dddddddd',
  ],
  [
    '...oooo...',
    '..oloooo..',
    '.oloooeeo.',
    'oooooooood',
    'oooooooood',
    'oooooooood',
    '.dddddddd.',
  ],
]
/** The flattest frame: the deepest squash of a wobble, a hop's landing, and the loser of a match. */
const FLAT = BLOB_ART.length - 1

/** A frame of a blob: its pixels, and the left one of its eye's two pixels, which the pupil picks from. */
type Look = { pixels: Painted; eye: { dx: number; dy: number } }

/**
 * Each side's blob frames. A row of even width centres on the blob's floored column, so facing left
 * mirrors `dx` to `-1 - dx`.
 */
const BLOB_FRAMES: Record<Side, readonly Look[]> = (() => {
  const paint = (side: Side, facing: number): Look[] => {
    const tones: Partial<Record<string, number>> = { o: BLOB_COLOR[side], l: BLOB_SHINE[side], d: BLOB_SHADE[side], e: EYE }

    return BLOB_ART.map(art => {
      const pixels = art.flatMap((line, i) =>
        [...line].flatMap((tone, j) => {
          const color = tones[tone]
          const dx = j - line.length / 2
          return color === undefined ? [] : [{ dx: facing > 0 ? dx : -1 - dx, dy: art.length - 1 - i, color }]
        }),
      )
      const eye = pixels.filter(p => p.color === EYE)

      return { pixels, eye: { dx: Math.min(...eye.map(p => p.dx)), dy: eye[0]?.dy ?? 0 } }
    })
  }

  return { you: paint('you', 1), claude: paint('claude', -1) }
})()

/** The frame of a wobble's step: the squash rises over the first half of WOBBLE_STEPS and falls back. */
function wobbleFrame(wobble: number): number {
  if (!(wobble > 0)) return 0
  const squash = 1 - Math.abs((2 * wobble) / WOBBLE_STEPS - 1)

  return Math.min(FLAT, Math.max(0, Math.round(squash * FLAT)))
}

/** Steps a hop of the winner spends on the ground at its end: two flat, then the middle frame. */
const HOP_LANDING = 5

/**
 * The winner's hop `t` steps into the win screen: up to HOP_PX and down again, then a landing
 * squashed flat and back. Drawing only; the blob itself stays where the last point left it.
 */
export function hop(t: number): { row: number; shape: number } {
  const flight = HOP_STEPS - HOP_LANDING
  const u = t % HOP_STEPS
  if (u >= flight) return { row: 0, shape: u < flight + 2 ? FLAT : 1 }

  return { row: Math.round((4 * HOP_PX * u * (flight - u)) / (flight * flight)), shape: 0 }
}

/** Where a blob is drawn and in which frame: as play left it, or on the win screen hopping or lying flat. */
function stance(game: Game, side: Side): { row: number; shape: number } {
  const blob = game.sim.blobs[side]
  const won = game.phase === 'matchEnd' ? game.lastMatch : null
  if (won === null) return { row: Math.floor(blob.y), shape: wobbleFrame(blob.wobble) }
  if (side !== won.winner) return { row: 0, shape: FLAT }

  return hop(MATCH_END_STEPS - game.timer)
}

/**
 * The weight of a pulsing line `step` steps into its beat: a third bright, a third plain, a third
 * faint, so it lights up and fades with every beat. The terminal's own attributes rather than
 * colours of the mod's, so the line reads on a dark and a light theme alike.
 */
export function pulse(step: number): Weight | undefined {
  const at = ((step % BEAT_STEPS) + BEAT_STEPS) % BEAT_STEPS
  if (at < BEAT_STEPS / 3) return 'bold'

  return at < (2 * BEAT_STEPS) / 3 ? undefined : 'dim'
}

/** Steps into the pulsing line's beat: each beat of the countdown, and the win screen's time; null for a still line. */
function beat(game: Game): number | null {
  if (game.phase === 'countdown') return Math.ceil(game.timer / BEAT_STEPS) * BEAT_STEPS - game.timer
  if (game.phase === 'matchEnd') return MATCH_END_STEPS - game.timer

  return null
}

/** A disc around the centre pixel; `r² + r` rounds its edge, plain `r²` would give it a pointed top. */
const BALL_SPRITE: Sprite = (() => {
  const sprite: { dx: number; dy: number }[] = []
  for (let dy = -BALL_R; dy <= BALL_R; dy++) {
    for (let dx = -BALL_R; dx <= BALL_R; dx++) if (dx * dx + dy * dy <= BALL_R * BALL_R + BALL_R) sprite.push({ dx, dy })
  }

  return sprite
})()

/** The line each phase shows on the court (PLAN.md 6.4), or null in play. The countdown and the win screen pulse (`pulse`). */
export function message(game: Game, rival: string): string | null {
  switch (game.phase) {
    case 'idle':
      return 'Click to play'
    case 'countdown':
      return String(Math.ceil(game.timer / BEAT_STEPS))
    case 'point':
      return game.lastPoint === 'you' ? 'Point for you' : `Point for ${rival}`
    case 'matchEnd': {
      const last = game.lastMatch
      if (last === null) return null
      return `${last.winner === 'you' ? 'You win' : `${rival} wins`} ${last.you} : ${last.claude}`
    }
    case 'paused':
      return 'Paused, click to resume'
    case 'rally':
      return null
  }
}

/** The message sits two rows above the net's top, clear of the hovering serve on every court height. */
export function messageRow(rows: number): number {
  return Math.max(0, Math.floor((2 * rows - groundPx(rows) - NET_H) / 2) - 2)
}

/** Paints one pixel by world column and world row (0 just above the ground); outside is dropped. */
function put(frame: Frame, air: number, col: number, row: number, color: number): void {
  const y = air - 1 - row
  if (col >= 0 && col < frame.w && y >= 0 && y < frame.h) frame.px[y * frame.w + col] = color
}

function stamp(frame: Frame, air: number, sprite: Sprite, col: number, row: number, color: number): void {
  for (const { dx, dy } of sprite) put(frame, air, col + dx, row + dy, color)
}

export function draw(game: Game, view: View): Frame {
  const { w, blobs, ball } = game.sim
  const h = 2 * view.rows
  const air = h - groundPx(view.rows)
  const frame: Frame = { w, h, px: new Uint8Array(w * h), overlays: [] }

  for (let y = air; y < h; y++) frame.px.fill(y === air ? GROUND_TOP : GROUND, y * w, (y + 1) * w)

  for (const side of SIDES) {
    const col = Math.floor(blobs[side].x)
    const { row, shape } = stance(game, side)
    const look = BLOB_FRAMES[side][shape]
    if (look === undefined) continue
    for (const p of look.pixels) put(frame, air, col + p.dx, row + p.dy, p.color)
    // The eyes follow the ball: the pupil takes the eye's pixel on the ball's side.
    const eye = col + look.eye.dx
    put(frame, air, ball.x < eye + 1 ? eye : eye + 1, row + look.eye.dy, PUPIL)
  }

  // The net's columns are those whose centres lie within NET_R of the middle. Drawn over the blobs,
  // so one squashed wide against it goes behind it.
  for (let col = Math.ceil(w / 2 - NET_R - 0.5); col + 0.5 < w / 2 + NET_R; col++) {
    for (let row = 0; row < NET_H; row++) put(frame, air, col, row, NET)
  }

  const col = Math.floor(ball.x)
  const row = Math.floor(ball.y)
  if (row - BALL_R < air) {
    stamp(frame, air, BALL_SPRITE, col, row, BALL)
  } else {
    // Wholly above the view: an arrow in the top two pixel rows marks its column.
    put(frame, air, col, air - 1, BALL)
    for (let dx = -1; dx <= 1; dx++) put(frame, air, col + dx, air - 2, BALL)
  }

  // In the terminal's own text colour, so it reads on a dark and a light theme alike.
  const text = message(game, view.rival)
  if (text !== null) {
    const overlay: Overlay = { row: messageRow(view.rows), col: Math.floor((w - text.length) / 2), text, color: SKY }
    const step = beat(game)
    const weight = step === null ? undefined : pulse(step)
    if (weight !== undefined) overlay.weight = weight
    frame.overlays.push(overlay)
  }

  return frame
}
