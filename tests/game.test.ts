import { expect, test } from 'claude-code/testing'

import { COUNTDOWN_STEPS, DONE_CUT_STEPS, MATCH_END_STEPS, POINT_STEPS } from '../core/constants'
import { awardPoint, dispatch, newGame, newMatch, tick } from '../core/game'
import { homeX, step } from '../core/sim'
import type { Game, GameEvent, Inputs, Match, Side } from '../core/types'
import type { VolleyMatch } from '../types'
import { STILL, chaos } from './support'

// tsc fails here if the core's Match and the stored VolleyMatch drift apart, optional fields too.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
const matchIsStored: Same<Match, VolleyMatch> = true

const at = (you: number, claude: number): Match => ({ ...newMatch(), you, claude })

function game(match = newMatch()): Game {
  return newGame({ w: 110, match, seed: 1 })
}

function run(g: Game, steps: number, inputs: () => Inputs = () => STILL): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < steps; i++) events.push(...tick(g, inputs()))

  return events
}

/** From the first click to the first step of the rally. */
function rally(g: Game): void {
  dispatch(g, { kind: 'start' })
  run(g, COUNTDOWN_STEPS)
}

/** Drops the ball just above the ground on a side: the next step loses that side the point. */
function drop(g: Game, side: Side): void {
  Object.assign(g.sim.ball, { x: side === 'you' ? 20 : 90, y: 3.1, vx: 0, vy: -10, hover: false })
}

/** A ball in flight, out of every blob's reach for a while. */
function inFlight(g: Game): void {
  Object.assign(g.sim.ball, { x: 40, y: 40, vx: 30, vy: 20, hover: false })
}

test('game: Match has the shape of the stored VolleyMatch', () => {
  expect(matchIsStored).toBe(true)
})

test('game: rally scoring, the winner serves, 11 with two clear wins', () => {
  const match = newMatch()
  expect(awardPoint(match, 'claude')).toBeNull()
  expect(match).toEqual({ v: 1, you: 0, claude: 1, server: 'claude', number: 1 })

  const close = at(10, 10)
  expect(awardPoint(close, 'you')).toBeNull()
  expect(close).toMatchObject({ you: 11, claude: 10 })
  expect(awardPoint(close, 'you')).toEqual({ winner: 'you', you: 12, claude: 10 })

  const clear = at(10, 9)
  expect(awardPoint(clear, 'you')).toEqual({ winner: 'you', you: 11, claude: 9 })
  expect(clear).toEqual(newMatch(2))

  const shutout = at(0, 10)
  expect(awardPoint(shutout, 'claude')).toEqual({ winner: 'claude', you: 0, claude: 11 })
  expect(shutout).toEqual({ v: 1, you: 0, claude: 0, server: 'you', number: 2 })
})

test('game: a new game waits for a click with the serve set up for the match server', () => {
  const g = game({ ...at(3, 4), server: 'claude' })

  expect(g.phase).toBe('idle')
  expect(g.match).toEqual({ ...at(3, 4), server: 'claude' })
  expect(g.sim.ball).toMatchObject({ x: homeX(110, 'claude'), y: 26, hover: true })
  expect(run(g, 100)).toEqual([])
  expect(g.phase).toBe('idle')
  expect(newGame({ w: 40, match: newMatch(), seed: 1 }).sim.w).toBe(60)
})

test('game: a click counts down, a point shows, then the scorer serves with no countdown', () => {
  const g = game()
  dispatch(g, { kind: 'start' })
  run(g, COUNTDOWN_STEPS - 1)
  expect(g.phase).toBe('countdown')
  run(g, 1)
  expect(g.phase).toBe('rally')

  drop(g, 'you')
  expect(run(g, 1)).toEqual([{ kind: 'point', side: 'claude' }])
  expect(g).toMatchObject({ phase: 'point', lastPoint: 'claude' })
  expect(g.match).toMatchObject({ you: 0, claude: 1, server: 'claude' })
  run(g, POINT_STEPS - 1)
  expect(g.phase).toBe('point')
  run(g, 1)
  expect(g.phase).toBe('rally')
  expect(g.sim.ball).toMatchObject({ x: homeX(110, 'claude'), y: 26, hover: true })
})

test('game: a won match shows the win screen, then waits for a click; a click skips it', () => {
  const g = game(at(10, 3))
  rally(g)
  drop(g, 'claude')
  expect(run(g, 1)).toEqual([
    { kind: 'point', side: 'you' },
    { kind: 'matchEnd', winner: 'you' },
  ])
  expect(g).toMatchObject({ phase: 'matchEnd', lastMatch: { winner: 'you', you: 11, claude: 3 } })
  expect(g.match).toEqual(newMatch(2))
  run(g, MATCH_END_STEPS - 1)
  expect(g.phase).toBe('matchEnd')
  run(g, 1)
  expect(g.phase).toBe('idle')
  expect(g.sim.ball).toMatchObject({ x: homeX(110, 'you'), hover: true })

  const skip = game(at(10, 3))
  rally(skip)
  drop(skip, 'claude')
  run(skip, 1)
  dispatch(skip, { kind: 'start' })
  expect(skip).toMatchObject({ phase: 'countdown', timer: COUNTDOWN_STEPS })
  expect(skip.sim.ball).toMatchObject({ x: homeX(110, 'you'), hover: true })
})

test('game: a pause freezes the rally, and a click resumes the same rally after the countdown', () => {
  const g = game()
  rally(g)
  inFlight(g)
  run(g, 5)
  dispatch(g, { kind: 'pause' })
  expect(g.phase).toBe('paused')

  const frozen = structuredClone(g.sim)
  run(g, 100, chaos(3))
  expect(g.sim).toEqual(frozen)

  dispatch(g, { kind: 'start' })
  run(g, COUNTDOWN_STEPS)
  expect(g.phase).toBe('rally')
  expect(g.sim).toEqual(frozen)

  run(g, 1)
  step(frozen, STILL)
  expect(g.sim).toEqual(frozen)
})

test('game: a pause between points sets up the next serve; idle and the win screen ignore it', () => {
  const g = game()
  rally(g)
  drop(g, 'you')
  run(g, 1)
  dispatch(g, { kind: 'pause' })
  expect(g.phase).toBe('paused')
  expect(g.sim.ball).toMatchObject({ x: homeX(110, 'claude'), hover: true })

  const idle = game()
  dispatch(idle, { kind: 'pause' })
  expect(idle.phase).toBe('idle')

  const won = game(at(10, 0))
  rally(won)
  drop(won, 'claude')
  run(won, 1)
  dispatch(won, { kind: 'pause' })
  expect(won.phase).toBe('matchEnd')
})

test('game: after the turn ends, an unfinished rally is cut off at 10 s of play and served again', () => {
  const g = game(at(2, 5))
  rally(g)
  expect(dispatch(g, { kind: 'turnDone' })).toEqual([])
  expect(run(g, DONE_CUT_STEPS - 1)).toEqual([])
  expect(g.phase).toBe('rally')

  expect(run(g, 1)).toEqual([{ kind: 'rallyOver' }])
  expect(g.phase).toBe('paused')
  expect(g.match).toEqual(at(2, 5))
  expect(g.sim.ball).toMatchObject({ x: homeX(110, 'you'), hover: true })
})

test('game: a second turn end keeps the first deadline', () => {
  const g = game()
  rally(g)
  dispatch(g, { kind: 'turnDone' })
  run(g, 300)
  dispatch(g, { kind: 'turnDone' })
  expect(run(g, DONE_CUT_STEPS - 301)).toEqual([])
  expect(run(g, 1)).toEqual([{ kind: 'rallyOver' }])
})

test('game: a point after the turn ended counts, then the rally is over at once', () => {
  const g = game()
  rally(g)
  dispatch(g, { kind: 'turnDone' })
  run(g, 10)
  drop(g, 'claude')

  expect(run(g, 1)).toEqual([
    { kind: 'point', side: 'you' },
    { kind: 'rallyOver' },
  ])
  expect(g.phase).toBe('paused')
  expect(g.match).toMatchObject({ you: 1, claude: 0, server: 'you' })
})

test('game: a turn end outside a rally is over at once', () => {
  const idle = game()
  expect(dispatch(idle, { kind: 'turnDone' })).toEqual([{ kind: 'rallyOver' }])
  expect(idle.phase).toBe('idle')

  const counting = game()
  dispatch(counting, { kind: 'start' })
  expect(dispatch(counting, { kind: 'turnDone' })).toEqual([{ kind: 'rallyOver' }])
  expect(counting.phase).toBe('paused')
})

test('game: a pause while the cut runs ends the rally at once', () => {
  const g = game()
  rally(g)
  inFlight(g)
  dispatch(g, { kind: 'turnDone' })
  run(g, 10)

  expect(dispatch(g, { kind: 'pause' })).toEqual([{ kind: 'rallyOver' }])
  expect(g).toMatchObject({ phase: 'paused', cut: null })
  expect(g.sim.ball).toMatchObject({ x: homeX(110, 'you'), hover: true })
})

test('game: a resize voids the rally; the same side serves again at the new width', () => {
  const g = game({ ...at(4, 4), server: 'claude' })
  rally(g)
  inFlight(g)
  run(g, 5)

  expect(dispatch(g, { kind: 'resize', w: 140 })).toEqual([])
  expect(g).toMatchObject({ phase: 'countdown', timer: COUNTDOWN_STEPS })
  expect(g.match).toEqual({ ...at(4, 4), server: 'claude' })
  expect(g.sim.w).toBe(140)
  expect(g.sim.ball).toMatchObject({ x: homeX(140, 'claude'), y: 26, hover: true })
  expect(g.sim.blobs.you).toEqual({ x: homeX(140, 'you'), y: 0, vy: 0, wobble: 0 })
})

test('game: the same width changes nothing, and widths clamp to 60 and 160', () => {
  const g = game()
  rally(g)
  inFlight(g)
  run(g, 5)
  const before = structuredClone(g)
  dispatch(g, { kind: 'resize', w: 110 })
  expect(g).toEqual(before)

  dispatch(g, { kind: 'resize', w: 20 })
  expect(g.sim.w).toBe(60)
  dispatch(g, { kind: 'resize', w: 500 })
  expect(g.sim.w).toBe(160)
})

test('game: a resize while the cut runs ends the rally', () => {
  const g = game()
  rally(g)
  dispatch(g, { kind: 'turnDone' })

  expect(dispatch(g, { kind: 'resize', w: 90 })).toEqual([{ kind: 'rallyOver' }])
  expect(g.phase).toBe('paused')
})

test('game: a reset takes the new match it is handed and waits for a click', () => {
  const g = game(at(7, 8))
  rally(g)
  dispatch(g, { kind: 'turnDone' })

  const next = newMatch(4)
  expect(dispatch(g, { kind: 'reset', match: next })).toEqual([{ kind: 'rallyOver' }])
  expect(g).toMatchObject({ phase: 'idle', cut: null, lastPoint: null, lastMatch: null })
  expect(g.match).toEqual(newMatch(4))
  expect(g.sim.ball).toMatchObject({ x: homeX(110, 'you'), hover: true })

  // The game keeps a copy: the props it came from may change under it.
  next.you = 9
  expect(g.match).toEqual(newMatch(4))
})

/** Random play by both sides; a click whenever the game waits for one. */
function play(g: Game, steps: number, inputs: () => Inputs): GameEvent[] {
  const events: GameEvent[] = []
  for (let i = 0; i < steps; i++) {
    if (g.phase === 'idle' || g.phase === 'paused') dispatch(g, { kind: 'start' })
    events.push(...tick(g, inputs()))
  }

  return events
}

test('game: the same seed and inputs give the same game after 10,000 steps', () => {
  const a = game()
  const events = play(a, 10_000, chaos(9))
  const b = game()
  play(b, 10_000, chaos(9))

  expect(b).toEqual(a)
  // The run must have played, not stood still.
  expect(events.filter(e => e.kind === 'point').length).toBeGreaterThan(20)
})

test('game: a copy taken mid run goes on exactly as the original', () => {
  const whole = game()
  play(whole, 10_000, chaos(11))

  const half = game()
  const inputs = chaos(11)
  play(half, 5_000, inputs)
  const copy = structuredClone(half)
  play(copy, 5_000, inputs)

  expect(copy).toEqual(whole)
  expect(JSON.parse(JSON.stringify(copy))).toEqual(copy)
})
