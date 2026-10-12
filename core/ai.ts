import { BALL_R, NET_H } from './constants'
import { PointerSource } from './input'
import type { InputSource } from './input'
import { random, seedRng } from './rng'
import { collideBlob, flyBall, homeX, moveBlob, other } from './sim'
import type { Ball, Blob, Game, Input, Side, Sim } from './types'

// The AI (PLAN.md 6.6), an input source under the human's limits. It predicts where the ball comes
// down on its side with the same physics as play and picks where to stand beside it: a hit sets the
// ball's speed along the line from the blob's centre to the ball's, so standing behind the ball by
// a pixel or four steers the shot. It plans only every so often, aims with an error and runs below
// full speed. Three levels differ in all of these and in how they pick the stand.

export type LevelName = 'easy' | 'medium' | 'hard'

export type AiLevel = {
  name: LevelName
  /** The name the AI plays under at this level, on the court and in /volley stats (PLAN.md 3.2). */
  player: string
  /** Steps between two plans: in between it acts on an old prediction. */
  reaction: number
  /** Pixels its stand may miss the planned one by, either way. */
  aimError: number
  /** Share of the full run speed. */
  speed: number
  /** Chance it jumps for a ball it can reach; a hovering serve it always jumps for. */
  jumpChance: number
  /**
   * How it picks its stand: `random` draws one for each ball and plays no shot out; `over` takes the
   * middle of the stands whose shot crosses the net; `away` the crossing stand whose ball comes
   * down furthest from the other blob.
   */
  placement: 'random' | 'over' | 'away'
}

// Tuned in M9 (PLAN.md 6.6): medium about even with the user, easy beatable, hard demanding.
// The names go from soft to firm jelly as the levels get harder (the user's choice, 2026-10-12).
export const EASY: AiLevel = { name: 'easy', player: 'Pudding', reaction: 21, aimError: 7, speed: 0.75, jumpChance: 0.2, placement: 'random' }
export const MEDIUM: AiLevel = { name: 'medium', player: 'Jelly', reaction: 12, aimError: 4, speed: 0.9, jumpChance: 0.6, placement: 'over' }
export const HARD: AiLevel = { name: 'hard', player: 'Gummy', reaction: 5, aimError: 1, speed: 1, jumpChance: 0.9, placement: 'away' }
export const LEVELS: Record<LevelName, AiLevel> = { easy: EASY, medium: MEDIUM, hard: HARD }

/** The ball is decided to be coming down on a side where it falls through this height. */
const HIT_Y = 11
/** Stands behind the ball the AI weighs, in pixels from where it falls through HIT_Y. */
const OFFSETS = [0, 1, 2, 3, 4, 5, 6]
/** The random stand lies between this many pixels in front of the ball (toward the net) and behind it. */
const RANDOM_FRONT = 3
const RANDOM_BEHIND = 6
/** A shot counts as over when it lands this far past the middle. */
const OVER = 2
/** It jumps for a ball within this many pixels across, below JUMP_BELOW and JUMP_ABOVE over its feet. */
const JUMP_REACH = 6
const JUMP_BELOW = 32
const JUMP_ABOVE = 5
/** Steps a prediction may look ahead; the longest flight across the widest court is shorter. */
const LOOK_STEPS = 600

/**
 * Where a shot is once it is past the net and lower than its top, from where it only comes down a
 * few pixels further on: how far past the middle, and at which x. A shot that never gets there is
 * followed to the ground.
 */
export type Shot = { past: number; land: number }
/** A stand the AI weighs, and its shot; null when the ball never meets a blob there. */
export type Stand = { x: number; shot: Shot | null }

/** Where the ball falls through HIT_Y next, by stepping a copy of it; a hovering ball stays put. */
function landing(sim: Sim): number {
  const ball: Ball = { ...sim.ball }
  if (ball.hover) return ball.x
  for (let i = 0; i < LOOK_STEPS && !(ball.vy < 0 && ball.y <= HIT_Y); i++) flyBall(ball, sim.w)

  return ball.x
}

/** Whether a blob that means to jump takes off for the ball now: close across, high, coming down. */
function reaches(ball: Ball, blob: Blob): boolean {
  return (
    Math.abs(ball.x - blob.x) < JUMP_REACH &&
    ball.y < JUMP_BELOW &&
    ball.y > blob.y + JUMP_ABOVE &&
    (ball.hover || ball.vy < 0)
  )
}

/**
 * Where the coming ball goes after it meets a blob waiting at `x`, which jumps for it when `jumps`;
 * null when they never meet. Played with the sim's own steps, so the plan sees the shot play will
 * make.
 */
function meet(sim: Sim, side: Side, x: number, jumps: boolean): Shot | null {
  const ball: Ball = { ...sim.ball }
  const blob: Blob = { x, y: 0, vy: 0, wobble: 0 }
  const ahead = side === 'you' ? 1 : -1
  let met = false
  for (let i = 0; i < LOOK_STEPS && ball.y > BALL_R; i++) {
    if (!met) moveBlob(blob, { run: 0, jump: jumps && reaches(ball, blob) }, sim.w, side)
    if (!ball.hover) flyBall(ball, sim.w)
    if (!met) met = collideBlob(ball, blob, sim.w)
    // Past the middle and lower than the net, a ball can only come down on the far side.
    else if (ahead * (ball.x - sim.w / 2) >= OVER && ball.y < NET_H) break
  }

  return met ? { past: ahead * (ball.x - sim.w / 2), land: ball.x } : null
}

function weigh(sim: Sim, side: Side, x: number, jumps: boolean): Stand[] {
  const ahead = side === 'you' ? 1 : -1

  return OFFSETS.map(offset => ({ x: x - ahead * offset, shot: meet(sim, side, x - ahead * offset, jumps) }))
}

/** The stands the AI weighs for the coming ball, each with its shot. */
export function shots(sim: Sim, side: Side, jumps: boolean): Stand[] {
  return weigh(sim, side, landing(sim), jumps)
}

/**
 * Where to wait for the coming ball, or null when it comes down on the other side. `pick`, from 0
 * to 1, places the random stand. A placement that weighs the shots falls back on the one that gets
 * furthest when none crosses.
 */
export function plan(sim: Sim, side: Side, jumps: boolean, level: AiLevel, pick: number): number | null {
  const x = landing(sim)
  const ahead = side === 'you' ? 1 : -1
  if (ahead * (x - sim.w / 2) >= 0) return null
  // Its own hovering serve waits for it, so that one is planned: a random stand could leave it hovering.
  if (level.placement === 'random' && !sim.ball.hover) return x + ahead * (RANDOM_FRONT - pick * (RANDOM_FRONT + RANDOM_BEHIND))

  const stands = weigh(sim, side, x, jumps)
  const over = stands.filter(s => s.shot !== null && s.shot.past >= OVER)
  if (over.length === 0) return stands.reduce((a, b) => ((b.shot?.past ?? -Infinity) > (a.shot?.past ?? -Infinity) ? b : a)).x
  if (level.placement === 'away') {
    const them = sim.blobs[other(side)].x
    const far = (s: Stand) => Math.abs((s.shot?.land ?? them) - them)
    return over.reduce((a, b) => (far(b) > far(a) ? b : a)).x
  }

  // The middle one leaves the most room for the aiming error.
  return over[Math.floor((over.length - 1) / 2)]?.x ?? x
}

export class AiSource implements InputSource {
  private readonly pointer = new PointerSource()
  private readonly holder: { rng: number }
  private wait = 0
  private stand: number | null = null
  private error = 0
  private jumps = false
  private pick = 0
  private moment = ''

  /** The court swaps `level` when /config changes it (PLAN.md 6.8); the next plan follows it. */
  constructor(
    public level: AiLevel,
    seed: number,
  ) {
    this.holder = { rng: seedRng(seed) }
  }

  next(game: Game, side: Side): Input {
    const { sim } = game
    const { ball, rally } = sim
    const blob = sim.blobs[side]

    // Each new ball (a touch, a serve) gets a fresh aiming error, a fresh mind to jump and a fresh
    // random stand.
    const moment = `${rally.server} ${rally.touchSide} ${rally.touches} ${ball.hover}`
    if (moment !== this.moment) {
      this.moment = moment
      this.error = (random(this.holder) * 2 - 1) * this.level.aimError
      this.jumps = random(this.holder) < this.level.jumpChance
      this.pick = random(this.holder)
    }

    if (--this.wait <= 0) {
      this.wait = this.level.reaction
      this.stand = plan(sim, side, this.jumps || ball.hover, this.level, this.pick)
    }

    // A hovering serve waits for the server, so the AI's own serve is never missed by its error.
    const error = ball.hover ? 0 : this.error
    this.pointer.column = this.stand === null ? homeX(sim.w, side) : this.stand + error
    this.pointer.button = this.stand !== null && (this.jumps || ball.hover) && reaches(ball, blob)
    const input = this.pointer.next(game, side)

    return { run: input.run * this.level.speed, jump: input.jump }
  }
}
