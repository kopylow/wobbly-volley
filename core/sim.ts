import {
  BALL_GRAVITY,
  BALL_R,
  BLOB_CIRCLES,
  BLOB_W,
  DT,
  GRAVITY,
  GRAVITY_HELD,
  JUMP_SPEED,
  MAX_TOUCHES,
  NET_H,
  NET_R,
  SERVE_Y,
  TOUCH_GAP,
  WOBBLE_STEPS,
  hitSpeed,
  runSpeed,
} from './constants'
import type { Ball, Blob, Input, Inputs, Side, Sim, StepResult } from './types'

// Physics and collisions (PLAN.md 6.3). Only + - * /, Math.sqrt, Math.abs, Math.min and Math.max
// touch the state: IEEE 754 rounds them exactly on every engine, so the same inputs give the same
// state on every machine.

/** You are always handled first, so a ball between both blobs at the net stays deterministic. */
export const SIDES: readonly Side[] = ['you', 'claude']

export function other(side: Side): Side {
  return side === 'you' ? 'claude' : 'you'
}

export function homeX(w: number, side: Side): number {
  return side === 'you' ? w / 4 : (3 * w) / 4
}

/** Where a blob's x may lie: its own half, clear of the wall and the net. */
export function blobRange(w: number, side: Side): { min: number; max: number } {
  const half = BLOB_W / 2

  return side === 'you' ? { min: half, max: w / 2 - NET_R - half } : { min: w / 2 + NET_R + half, max: w - half }
}

export function newSim(w: number, server: Side): Sim {
  const sim: Sim = {
    w,
    blobs: { you: { x: 0, y: 0, vy: 0, wobble: 0 }, claude: { x: 0, y: 0, vy: 0, wobble: 0 } },
    ball: { x: 0, y: 0, vx: 0, vy: 0, hover: true },
    rally: { server, touchSide: null, touches: 0, gap: { you: TOUCH_GAP, claude: TOUCH_GAP } },
  }
  serve(sim, server)

  return sim
}

/** Both blobs home, the ball hovering above the server, the touch count cleared. */
export function serve(sim: Sim, server: Side): void {
  for (const side of SIDES) Object.assign(sim.blobs[side], { x: homeX(sim.w, side), y: 0, vy: 0, wobble: 0 })
  Object.assign(sim.ball, { x: homeX(sim.w, server), y: SERVE_Y, vx: 0, vy: 0, hover: true })
  Object.assign(sim.rally, { server, touchSide: null, touches: 0, gap: { you: TOUCH_GAP, claude: TOUCH_GAP } })
}

/** One fixed step in the order of PLAN.md 6.3. */
export function step(sim: Sim, inputs: Inputs): StepResult {
  const { w, ball, rally } = sim

  for (const side of SIDES) moveBlob(sim.blobs[side], inputs[side], w, side)

  if (!ball.hover) moveBall(ball)

  let hit: Side | null = null
  for (const side of SIDES) {
    if (!collideBlob(ball, sim.blobs[side], w)) {
      rally.gap[side] = Math.min(TOUCH_GAP, rally.gap[side] + 1)
      continue
    }
    const counts = rally.gap[side] >= TOUCH_GAP
    rally.gap[side] = 0
    if (!counts) continue
    hit = side
    if (rally.touchSide === side) {
      rally.touches++
    } else {
      rally.touchSide = side
      rally.touches = 1
    }
  }

  bounceWalls(ball, w)
  collideNet(ball, w)

  if (rally.touchSide !== null && rally.touches > MAX_TOUCHES) return { scored: other(rally.touchSide), hit }

  if (ball.y - BALL_R <= 0) {
    ball.y = BALL_R

    return { scored: ball.x < w / 2 ? 'claude' : 'you', hit }
  }

  return { scored: null, hit }
}

/**
 * One step of a free ball: gravity, the walls and the net, no blobs and no ground. The AI predicts
 * the flight with it, so its prediction follows the same physics as play.
 */
export function flyBall(ball: Ball, w: number): void {
  moveBall(ball)
  bounceWalls(ball, w)
  collideNet(ball, w)
}

function moveBall(ball: Ball): void {
  ball.vy -= BALL_GRAVITY * DT
  ball.x += ball.vx * DT
  ball.y += ball.vy * DT
}

function bounceWalls(ball: Ball, w: number): void {
  if (ball.x < BALL_R) {
    ball.x = BALL_R
    ball.vx = Math.abs(ball.vx)
  } else if (ball.x > w - BALL_R) {
    ball.x = w - BALL_R
    ball.vx = -Math.abs(ball.vx)
  }
}

/** One step of a blob: run within its half, take off, fall, land, wobble. */
export function moveBlob(blob: Blob, input: Input, w: number, side: Side): void {
  // Written so that NaN stands still instead of spreading into the state.
  const run = input.run > 0 ? Math.min(1, input.run) : input.run < 0 ? Math.max(-1, input.run) : 0
  const { min, max } = blobRange(w, side)
  const from = blob.x
  blob.x = Math.min(max, Math.max(min, blob.x + run * runSpeed(w) * DT))

  // A blob on the ground that walks at half speed or more, or takes off, sets a new wobble going
  // once the last one is over. Pressing against the net or a wall moves it no more, so it rests.
  const sets = blob.y === 0 && (2 * Math.abs(blob.x - from) >= runSpeed(w) * DT || input.jump)
  // A wobble that is not a count (a blob from before it existed) counts as at rest.
  blob.wobble = blob.wobble > 0 && blob.wobble < WOBBLE_STEPS - 1 ? blob.wobble + 1 : sets ? 1 : 0

  if (blob.y === 0 && input.jump) blob.vy = JUMP_SPEED
  if (blob.y > 0 || blob.vy > 0) {
    blob.vy -= (input.jump && blob.vy > 0 ? GRAVITY_HELD : GRAVITY) * DT
    blob.y += blob.vy * DT
    if (blob.y <= 0) {
      blob.y = 0
      blob.vy = 0
    }
  }
}

/** Pushes the ball out of each blob circle it overlaps and sends it off at the hit speed. */
export function collideBlob(ball: Ball, blob: Blob, w: number): boolean {
  let contact = false
  for (const circle of BLOB_CIRCLES) {
    const cx = blob.x
    const cy = blob.y + circle.dy
    const dx = ball.x - cx
    const dy = ball.y - cy
    const reach = circle.r + BALL_R
    const d2 = dx * dx + dy * dy
    if (d2 >= reach * reach) continue

    const d = Math.sqrt(d2)
    // Centres on top of each other: straight up.
    const nx = d > 0 ? dx / d : 0
    const ny = d > 0 ? dy / d : 1
    const speed = hitSpeed(w)
    ball.x = cx + nx * reach
    ball.y = cy + ny * reach
    ball.vx = nx * speed
    ball.vy = ny * speed
    ball.hover = false
    contact = true
  }

  return contact
}

/** The net is a vertical capsule: a segment from the ground to NET_H - NET_R, NET_R thick. */
function collideNet(ball: Ball, w: number): void {
  const x = w / 2
  const y = Math.min(NET_H - NET_R, Math.max(0, ball.y))
  const dx = ball.x - x
  const dy = ball.y - y
  const reach = NET_R + BALL_R
  const d2 = dx * dx + dy * dy
  if (d2 >= reach * reach) return

  const d = Math.sqrt(d2)
  // Dead on the net line: back to the side it came from.
  const nx = d > 0 ? dx / d : ball.vx > 0 ? -1 : 1
  const ny = d > 0 ? dy / d : 0
  ball.x = x + nx * reach
  ball.y = y + ny * reach
  const into = ball.vx * nx + ball.vy * ny
  if (into < 0) {
    ball.vx -= 2 * into * nx
    ball.vy -= 2 * into * ny
  }
}
