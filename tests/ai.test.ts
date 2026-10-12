import { expect, test } from 'claude-code/testing'

import { AiSource, EASY, HARD, LEVELS, MEDIUM, plan, shots } from '../core/ai'
import type { AiLevel, Stand } from '../core/ai'
import { COUNTDOWN_STEPS } from '../core/constants'
import { dispatch, newGame, newMatch, tick } from '../core/game'
import { STAND } from '../core/input'
import type { InputSource } from '../core/input'
import { SIDES, blobRange, newSim } from '../core/sim'
import type { Game, Side, Sim } from '../core/types'

// The AI's three levels (PLAN.md 6.6). Every level serves and sends the ball over; medium's plan
// crosses the net and plays rallies that end (M5); in 200 seeded rallies each level beats the one
// below it, and each placement picks its stand by its own rule (M9).

const WIDTHS = [60, 110, 160]
const SECOND = 60
/** A shot counts as over when it lands this far past the middle (OVER in core/ai.ts). */
const OVER = 2

/** Stands at home and serves: jumps while its own serve hovers above it. */
const SERVER: InputSource = {
  next: (game: Game, side: Side) => ({ ...STAND, jump: game.sim.ball.hover && game.sim.rally.server === side }),
}

type Tally = { points: Record<Side, number>; touches: Record<Side, number>; over: Record<Side, number>; longest: number; outside: number }

function none(): Tally {
  return { points: { you: 0, claude: 0 }, touches: { you: 0, claude: 0 }, over: { you: 0, claude: 0 }, longest: 0, outside: 0 }
}

function both(counts: Record<Side, number>): number {
  return counts.you + counts.claude
}

/**
 * Plays until `points` points have fallen or `touches` touches were made, starting each match as a
 * click would. `over` counts the touches whose ball crossed the net afterwards, `outside` the steps
 * with a blob out of its half, `longest` the longest rally in steps.
 */
function play(w: number, seed: number, sources: Record<Side, InputSource>, limit: { points?: number; touches?: number }): Tally {
  const game = newGame({ w, match: newMatch(), seed })
  const tally = none()
  const points = limit.points ?? Infinity
  const touches = limit.touches ?? Infinity
  let rally = 0
  // The side whose touch has not crossed the net yet.
  let pending: Side | null = null
  dispatch(game, { kind: 'start' })

  // A point takes seconds; the step limit only stops a broken AI from hanging the run.
  for (let i = 0; i < 3600 * SECOND && both(tally.points) < points && both(tally.touches) < touches; i++) {
    if (game.phase === 'idle') dispatch(game, { kind: 'start' })
    const playing = game.phase === 'rally'
    const touch = `${game.sim.rally.touchSide} ${game.sim.rally.touches}`
    const events = tick(game, { you: sources.you.next(game, 'you'), claude: sources.claude.next(game, 'claude') })
    if (!playing) continue
    rally++

    for (const side of SIDES) {
      const { min, max } = blobRange(w, side)
      const x = game.sim.blobs[side].x
      if (x < min || x > max) tally.outside++
    }
    const { ball, rally: now } = game.sim
    if (pending !== null && (pending === 'you' ? ball.x > w / 2 : ball.x < w / 2)) {
      tally.over[pending]++
      pending = null
    }
    if (now.touchSide !== null && `${now.touchSide} ${now.touches}` !== touch) {
      tally.touches[now.touchSide]++
      pending = now.touchSide
    }
    for (const event of events) {
      if (event.kind !== 'point') continue
      tally.points[event.side]++
      tally.longest = Math.max(tally.longest, rally)
      rally = 0
      pending = null
    }
  }

  return tally
}

/** 200 rallies, 67 on each width, `strong` on Claude's side against `weak` on yours; summed. */
function rallies(strong: AiLevel, weak: AiLevel): Tally {
  const sum = none()
  for (const w of WIDTHS) {
    const t = play(w, 21, { you: new AiSource(weak, 22), claude: new AiSource(strong, 23) }, { points: 67 })
    for (const side of SIDES) {
      sum.points[side] += t.points[side]
      sum.touches[side] += t.touches[side]
      sum.over[side] += t.over[side]
    }
    sum.longest = Math.max(sum.longest, t.longest)
    sum.outside += t.outside
  }

  return sum
}

/** The stronger level's share of the points, and its touches and the weaker's crossing the net. */
function shares(t: Tally): { won: number; strong: number; weak: number } {
  return { won: t.points.claude / both(t.points), strong: t.over.claude / t.touches.claude, weak: t.over.you / t.touches.you }
}

test('ai: every level takes its serve within a second and sends it over the net', () => {
  for (const level of Object.values(LEVELS)) {
    for (const w of WIDTHS) {
      let over = 0
      for (let seed = 1; seed <= 20; seed++) {
        const game = newGame({ w, match: { ...newMatch(), server: 'claude' }, seed })
        const ai = new AiSource(level, seed)
        dispatch(game, { kind: 'start' })
        for (let i = 0; i < COUNTDOWN_STEPS; i++) tick(game, { you: STAND, claude: STAND })

        let steps = 0
        for (; game.sim.ball.hover && steps < 10 * SECOND; steps++) tick(game, { you: STAND, claude: ai.next(game, 'claude') })
        expect(steps).toBeLessThan(SECOND)
        for (let i = 0; i < 3 * SECOND && game.phase === 'rally' && game.sim.ball.x > w / 2; i++) tick(game, { you: STAND, claude: ai.next(game, 'claude') })
        if (game.sim.ball.x < w / 2) over++
      }
      expect(over).toBeGreaterThanOrEqual(19)
    }
  }
})

test('ai: with no aiming error its plan sends the ball over the net', () => {
  // The plan plays each stand with the sim's own steps, so its shots cross: 84 to 95% of touches
  // across the widths (the narrow court is the hardest).
  const exact: AiLevel = { ...MEDIUM, aimError: 0 }
  for (const w of WIDTHS) {
    const tally = play(w, 1, { you: new AiSource(exact, 2), claude: new AiSource(exact, 3) }, { touches: 300 })
    expect(both(tally.touches)).toBe(300)
    expect(both(tally.over) / both(tally.touches)).toBeGreaterThan(0.75)
  }
})

test('ai: with an aiming error of 3 px two in three of its touches still cross the net', () => {
  // The plan takes the middle of the stands that work, which leaves the error the most room: over
  // 1,000 touches a width about two in three cross, against about 61% for the first stand that
  // works (M5, when medium's error was 3 px). Fewer touches swing too far with the seed to tell
  // them apart.
  const three: AiLevel = { ...MEDIUM, aimError: 3 }
  let touches = 0
  let over = 0
  for (const w of WIDTHS) {
    const tally = play(w, 9, { you: new AiSource(three, 10), claude: new AiSource(three, 11) }, { touches: 1000 })
    touches += both(tally.touches)
    over += both(tally.over)
  }
  expect(over / touches).toBeGreaterThan(0.64)
})

test('ai: medium against itself plays rallies that end, with points for both sides', () => {
  for (const w of WIDTHS) {
    const tally = play(w, 4, { you: new AiSource(MEDIUM, 5), claude: new AiSource(MEDIUM, 6) }, { points: 30 })
    expect(tally.points.you).toBeGreaterThanOrEqual(8)
    expect(tally.points.claude).toBeGreaterThanOrEqual(8)
    expect(tally.outside).toBe(0)
    // A rally ends at the first fault, so between two sides that rarely fail its longest grows with
    // the number of rallies: 97 s in 2,000 rallies on 160 columns (PLAN.md section 11, M9).
    expect(tally.longest).toBeLessThan(90 * SECOND)
  }
})

test('ai: medium wins nearly every point against a player who only serves', () => {
  for (const w of WIDTHS) {
    const tally = play(w, 7, { you: SERVER, claude: new AiSource(MEDIUM, 8) }, { points: 40 })
    expect(tally.points.claude).toBeGreaterThanOrEqual(36)
  }
})

test('ai: hard beats easy in at least 80% of 200 seeded rallies, none longer than a minute', () => {
  const t = rallies(HARD, EASY)
  const { won, strong, weak } = shares(t)
  expect(won).toBeGreaterThanOrEqual(0.8)
  expect(t.longest).toBeLessThanOrEqual(60 * SECOND)
  expect(t.outside).toBe(0)
  expect(strong).toBeGreaterThan(weak)
})

test('ai: medium lies between: it beats easy in at least 65% of 200 rallies, none longer than a minute', () => {
  const t = rallies(MEDIUM, EASY)
  const { won, strong, weak } = shares(t)
  expect(won).toBeGreaterThanOrEqual(0.65)
  expect(t.longest).toBeLessThanOrEqual(60 * SECOND)
  expect(t.outside).toBe(0)
  expect(strong).toBeGreaterThan(weak)
})

test('ai: medium lies between: hard beats it in at least 65% of 200 rallies, none longer than 3 minutes', { timeoutMs: 15000 }, () => {
  const t = rallies(HARD, MEDIUM)
  const { won, strong, weak } = shares(t)
  expect(won).toBeGreaterThanOrEqual(0.65)
  expect(t.longest).toBeLessThan(180 * SECOND)
  expect(t.outside).toBe(0)
  expect(strong).toBeGreaterThan(weak)
})

/** A ball on its way down on Claude's side of a 110 column court: six of the stands send it over. */
function coming(): Sim {
  const sim = newSim(110, 'you')
  Object.assign(sim.ball, { x: 40, y: 40, vx: 30, vy: 10, hover: false })

  return sim
}

function crossing(stands: Stand[]): Stand[] {
  return stands.filter(s => s.shot !== null && s.shot.past >= OVER)
}

test('ai: medium takes the middle of the stands that send the ball over; a ball for your side sends every level home', () => {
  const sim = coming()
  const over = crossing(shots(sim, 'claude', false))
  expect(over.length).toBeGreaterThanOrEqual(4)
  expect(plan(sim, 'claude', false, MEDIUM, 0)).toBe(over[Math.floor((over.length - 1) / 2)]?.x)

  // Your own serve hovers on your side: no level plans a stand for it.
  const yours = newSim(110, 'you')
  for (const level of Object.values(LEVELS)) expect(plan(yours, 'claude', true, level, 0.5)).toBe(null)
})

test('ai: hard aims away from your blob: deep with you at the net, short with you at the back wall', () => {
  const sim = coming()
  const over = crossing(shots(sim, 'claude', false))
  const land = (stand: number | null) => over.find(s => s.x === stand)?.shot?.land ?? Number.NaN
  // Where medium's shot comes down, for comparison; your back wall is at 0.
  const middle = land(plan(sim, 'claude', false, MEDIUM, 0))

  sim.blobs.you.x = 52
  const deep = land(plan(sim, 'claude', false, HARD, 0))
  expect(Math.abs(deep - 52)).toBe(Math.max(...over.map(s => Math.abs((s.shot?.land ?? 52) - 52))))
  expect(deep).toBeLessThan(middle)

  sim.blobs.you.x = 6
  const short = land(plan(sim, 'claude', false, HARD, 0))
  expect(Math.abs(short - 6)).toBe(Math.max(...over.map(s => Math.abs((s.shot?.land ?? 6) - 6))))
  expect(short).toBeGreaterThan(middle)
})

test('ai: easy stands anywhere from 3 px in front of the ball to 6 px behind it; its own serve is planned', () => {
  const sim = coming()
  // The stand 0 px behind the ball is where it falls through the hit height; the net is to the left.
  const ball = shots(sim, 'claude', false)[0]?.x ?? Number.NaN
  expect(plan(sim, 'claude', false, EASY, 0)).toBe(ball - 3)
  expect(plan(sim, 'claude', false, EASY, 0.5)).toBe(ball + 1.5)
  expect(plan(sim, 'claude', false, EASY, 1)).toBe(ball + 6)

  // A random stand could leave its own hovering serve hovering for ever; that one it plans as medium does.
  const serve = newSim(110, 'claude')
  expect(plan(serve, 'claude', true, EASY, 0)).toBe(plan(serve, 'claude', true, MEDIUM, 0))
})

test('ai: easy draws its stand once for each ball and stays on it', () => {
  // A high ball flies to Claude's side. Once easy's blob has come to rest it does not set off again
  // before the touch; a stand drawn at every plan sent it off two to five times a ball.
  let rested = 0
  let restarts = 0
  for (let seed = 1; seed <= 10; seed++) {
    const game = newGame({ w: 110, match: newMatch(), seed })
    game.phase = 'rally'
    Object.assign(game.sim.ball, { x: 15, y: 30, vx: 32, vy: 140, hover: false })
    const easy = new AiSource(EASY, seed)
    let resting = false
    let last = game.sim.blobs.claude.x
    for (let i = 0; i < 600 && game.phase === 'rally' && game.sim.rally.touchSide === null; i++) {
      tick(game, { you: STAND, claude: easy.next(game, 'claude') })
      const x = game.sim.blobs.claude.x
      // Below full speed the blob closes in on its stand by a share of the gap each step: it rests within 0.01 px.
      const moving = Math.abs(x - last) > 0.01
      if (resting && moving) restarts++
      if (!moving && !resting) rested++
      resting = !moving
      last = x
    }
  }
  expect(rested).toBeGreaterThanOrEqual(10)
  expect(restarts).toBe(0)
})
