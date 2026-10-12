import { expect, test } from 'claude-code/testing'

import { EASY } from '../core/ai'
import {
  BALL_R,
  BLOB_CIRCLES,
  DT,
  GRAVITY,
  GRAVITY_HELD,
  JUMP_SPEED,
  NET_H,
  NET_R,
  TOUCH_GAP,
  WOBBLE_STEPS,
  hitSpeed,
  runSpeed,
} from '../core/constants'
import { random, seedRng } from '../core/rng'
import { SIDES, blobRange, homeX, newSim, serve, step } from '../core/sim'
import type { Inputs, Side, Sim, StepResult } from '../core/types'
import { STILL, chaos, only } from './support'

const WIDTHS = [60, 110, 160]

// Every loop here has a limit: a synchronous endless loop hangs the kit, its time limit never fires.
const LIMIT = 2000

/** Steps until `done` holds. */
function stepUntil(sim: Sim, done: (result: StepResult) => boolean, inputs: Inputs = STILL): StepResult {
  for (let i = 0; i < LIMIT; i++) {
    const result = step(sim, inputs)
    if (done(result)) return result
  }
  throw new Error(`not done after ${LIMIT} steps`)
}

/** Apex of a jump by your blob with jump held for `hold` steps; the serve hovers on Claude's side. */
function jump(hold: number): { apex: number; sim: Sim } {
  const sim = newSim(110, 'claude')
  let apex = 0
  for (let steps = 0; steps < LIMIT; steps++) {
    step(sim, only('you', { run: 0, jump: steps < hold }))
    apex = Math.max(apex, sim.blobs.you.y)
    if (sim.blobs.you.y <= 0) return { apex, sim }
  }
  throw new Error(`no landing after ${LIMIT} steps`)
}

/** Free ball at a spot with a velocity; the blobs stay home. */
function throwBall(sim: Sim, x: number, y: number, vx: number, vy: number): void {
  Object.assign(sim.ball, { x, y, vx, vy, hover: false })
}

/** Puts the ball into the upper circle of a side's blob, still, and steps once. */
function touch(sim: Sim, side: Side) {
  const blob = sim.blobs[side]
  Object.assign(sim.ball, { x: blob.x, y: blob.y + 10.2, vx: 0, vy: 0, hover: true })

  return step(sim, STILL)
}

/** Steps with the ball parked far above the court, out of everyone's reach. */
function wait(sim: Sim, steps: number): void {
  for (let i = 0; i < steps; i++) {
    Object.assign(sim.ball, { x: sim.w / 4, y: 500, vx: 0, vy: 0, hover: true })
    step(sim, STILL)
  }
}

test('sim: a held jump peaks just below v²/2g with the held gravity, a tap just below the plain one', () => {
  const held = jump(1000).apex
  const tap = jump(1).apex
  const heldTheory = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY_HELD)
  const tapTheory = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY)

  expect(held).toBeLessThan(heldTheory)
  expect(held).toBeGreaterThan(heldTheory - 1)
  expect(tap).toBeLessThan(tapTheory)
  expect(tap).toBeGreaterThan(tapTheory - 0.5)
})

test('sim: a longer hold never jumps lower, and the blob lands at exactly 0', () => {
  let last = 0
  for (let hold = 1; hold <= 30; hold++) {
    const { apex, sim } = jump(hold)
    expect(apex).toBeGreaterThanOrEqual(last)
    expect(sim.blobs.you).toMatchObject({ y: 0, vy: 0 })
    last = apex
  }
})

test('sim: run is clamped to [-1, 1] and NaN stands still', () => {
  const fast = newSim(110, 'claude')
  const full = newSim(110, 'claude')
  const odd = newSim(110, 'claude')
  step(fast, only('you', { run: 5, jump: false }))
  step(full, only('you', { run: 1, jump: false }))
  step(odd, only('you', { run: Number.NaN, jump: false }))

  expect(fast.blobs.you.x).toBe(full.blobs.you.x)
  expect(full.blobs.you.x).toBe(homeX(110, 'you') + runSpeed(110) * DT)
  expect(odd.blobs.you.x).toBe(homeX(110, 'you'))
})

test('sim: walking keeps the wobble going, pressing against the net lets it run out', () => {
  const sim = newSim(110, 'claude')
  const wobbles: number[] = []
  for (let i = 0; i < 60; i++) {
    step(sim, only('you', { run: 1, jump: false }))
    wobbles.push(sim.blobs.you.wobble)
  }

  // Steps 1 to WOBBLE_STEPS - 1 of one wobble, and the next follows at once.
  const one = Array.from({ length: WOBBLE_STEPS - 1 }, (_, i) => i + 1)
  expect(wobbles.slice(0, WOBBLE_STEPS + 1)).toEqual([...one, 1, 2])
  // At the net after about 32 steps, at rest after the wobble under way.
  expect(sim.blobs.you.x).toBe(blobRange(110, 'you').max)
  expect(wobbles.slice(-10)).toEqual(Array<number>(10).fill(0))
  expect(sim.blobs.claude.wobble).toBe(0)
})

test('sim: a take-off sets a wobble going; a slow creep and walking in the air set none', () => {
  const sim = newSim(110, 'claude')
  step(sim, only('you', { run: 0.4, jump: false }))
  expect(sim.blobs.you.wobble).toBe(0)

  // From a stand, so the take-off alone sets it.
  step(sim, only('you', { run: 0, jump: true }))
  expect(sim.blobs.you.wobble).toBe(1)
  for (let i = 1; i < WOBBLE_STEPS; i++) step(sim, only('you', { run: 1, jump: true }))
  // A held jump outlasts one wobble.
  expect(sim.blobs.you.y).toBeGreaterThan(0)
  expect(sim.blobs.you.wobble).toBe(0)
})

test("sim: the slowest level's pace keeps a wobble going too, and a serve puts both blobs at rest", () => {
  const sim = newSim(110, 'claude')
  for (let i = 0; i < 5; i++) step(sim, { you: { run: EASY.speed, jump: false }, claude: { run: -EASY.speed, jump: false } })
  expect([sim.blobs.you.wobble, sim.blobs.claude.wobble]).toEqual([5, 5])

  serve(sim, 'you')
  expect([sim.blobs.you.wobble, sim.blobs.claude.wobble]).toEqual([0, 0])
})

test('sim: a blob without a wobble count, as from before the wobble, counts as at rest', () => {
  const sim = newSim(110, 'claude')
  for (const side of SIDES) Reflect.deleteProperty(sim.blobs[side], 'wobble')
  step(sim, only('you', { run: 1, jump: false }))

  expect([sim.blobs.you.wobble, sim.blobs.claude.wobble]).toEqual([1, 0])
})

test('sim: under random play each blob stays in its own half', () => {
  for (const w of WIDTHS) {
    const sim = newSim(w, 'you')
    const inputs = chaos(w)
    for (let i = 0; i < 20_000; i++) {
      if (step(sim, inputs()).scored) serve(sim, i % 2 ? 'you' : 'claude')
      for (const side of SIDES) {
        const { min, max } = blobRange(w, side)
        const { x } = sim.blobs[side]
        if (x < min || x > max) throw new Error(`w ${w}, step ${i}: ${side} at ${x}, range ${min} to ${max}`)
      }
    }
  }
})

test('sim: the side walls send the ball back at the same speed', () => {
  const sim = newSim(110, 'you')
  throwBall(sim, 20, 30, -100, 0)
  stepUntil(sim, () => sim.ball.vx > 0)
  expect(sim.ball.vx).toBe(100)
  expect(sim.ball.x).toBe(BALL_R)

  throwBall(sim, 90, 30, 100, 0)
  stepUntil(sim, () => sim.ball.vx < 0)
  expect(sim.ball.vx).toBe(-100)
  expect(sim.ball.x).toBe(110 - BALL_R)
})

test('sim: a flat ball bounces off the net to its own side at the same speed', () => {
  const sim = newSim(110, 'claude')
  throwBall(sim, 45, 8, 80, 0)
  stepUntil(sim, () => sim.ball.vx < 0)

  expect(sim.ball.vx).toBe(-80)
  expect(sim.ball.x).toBe(55 - NET_R - BALL_R)
})

test('sim: a ball already leaving the net is pushed clear but keeps its course', () => {
  const sim = newSim(110, 'claude')
  throwBall(sim, 52, 8, -50, 0)
  step(sim, STILL)

  expect(sim.ball.vx).toBe(-50)
  expect(sim.ball.x).toBe(55 - NET_R - BALL_R)
})

test('sim: a ball dropping on the net top just left of the middle leaves to the left', () => {
  const sim = newSim(110, 'claude')
  throwBall(sim, 54.5, 30, 0, 0)
  stepUntil(sim, () => sim.ball.vx !== 0)

  expect(sim.ball.vx).toBeLessThan(0)
  expect(sim.ball.x).toBeLessThan(55)
})

test('sim: a ball changes sides only above the net', () => {
  const sim = newSim(110, 'claude')
  const holder = { rng: seedRng(5) }
  const top = NET_H - NET_R
  let crossings = 0
  for (let n = 0; n < 500; n++) {
    serve(sim, 'claude')
    const angle = random(holder) * 2 - 1
    const speed = hitSpeed(110) * (0.3 + random(holder))
    throwBall(sim, 5 + random(holder) * 44, 3 + random(holder) * 40, speed, speed * angle)
    for (let i = 0; i < 1200; i++) {
      const before = { ...sim.ball }
      const { scored } = step(sim, STILL)
      if (before.x < 55 !== sim.ball.x < 55) {
        crossings++
        if (before.y <= top || sim.ball.y <= top) throw new Error(`throw ${n}: crossed at ${before.y} to ${sim.ball.y}`)
      }
      if (scored) break
    }
  }
  // The property must have been tested, not passed by no ball ever crossing.
  expect(crossings).toBeGreaterThan(50)
})

test('sim: every blob hit sends the ball off at the hit speed along the line between the centres', () => {
  for (const w of WIDTHS) {
    const sim = newSim(w, 'claude')
    const blob = sim.blobs.you
    const upper = BLOB_CIRCLES[1]
    throwBall(sim, blob.x + 2, 25, 0, 0)
    const { hit } = stepUntil(sim, result => result.hit !== null)

    const { x, y, vx, vy } = sim.ball
    const speed = hitSpeed(w)
    const reach = upper.r + BALL_R
    expect(hit).toBe('you')
    expect(Math.abs(Math.sqrt(vx * vx + vy * vy) - speed)).toBeLessThan(1e-9)
    expect(Math.abs(vx / speed - (x - blob.x) / reach)).toBeLessThan(1e-9)
    expect(Math.abs(vy / speed - (y - blob.y - upper.dy) / reach)).toBeLessThan(1e-9)
  }
})

test('sim: the serve hovers until a blob touches it, and that first touch counts', () => {
  const sim = newSim(110, 'you')
  for (let i = 0; i < 100; i++) step(sim, STILL)
  expect(sim.ball).toMatchObject({ x: homeX(110, 'you'), y: 26, hover: true })

  stepUntil(sim, result => result.hit !== null, only('you', { run: 0, jump: true }))
  expect(sim.ball.hover).toBe(false)
  expect(sim.rally).toMatchObject({ touchSide: 'you', touches: 1 })
})

// A blob may squeeze the ball against a wall or the net for a step, so the ball may overlap a blob
// but never reach a circle's inside. Nothing moves the ball after the net, so it never overlaps it.
test('sim: under random play the ball never ends a step inside a blob or touching the net', () => {
  for (const w of WIDTHS) {
    const sim = newSim(w, 'you')
    const inputs = chaos(w + 1)
    for (let i = 0; i < 20_000; i++) {
      if (step(sim, inputs()).scored) serve(sim, i % 2 ? 'you' : 'claude')
      const { ball } = sim
      for (const side of SIDES) {
        for (const circle of BLOB_CIRCLES) {
          const dx = ball.x - sim.blobs[side].x
          const dy = ball.y - sim.blobs[side].y - circle.dy
          if (dx * dx + dy * dy < circle.r * circle.r) throw new Error(`w ${w}, step ${i}: ball inside ${side}`)
        }
      }
      const ny = Math.min(NET_H - NET_R, Math.max(0, ball.y))
      const nx = ball.x - w / 2
      const reach = NET_R + BALL_R
      if (nx * nx + (ball.y - ny) ** 2 < reach * reach - 1e-9) throw new Error(`w ${w}, step ${i}: ball in the net`)
    }
  }
})

test('sim: a blob juggling the serve on its head loses the point at its fourth touch', () => {
  const sim = newSim(110, 'you')
  const hits: Side[] = []
  let scored: Side | null = null
  for (let i = 0; i < 3000 && scored === null; i++) {
    const result = step(sim, only('you', { run: 0, jump: true }))
    if (result.hit) hits.push(result.hit)
    scored = result.scored
  }

  expect(hits).toEqual(['you', 'you', 'you', 'you'])
  expect(scored).toBe('claude')
})

test('sim: contacts closer together than the touch gap count as one touch', () => {
  const sim = newSim(110, 'you')
  for (let i = 0; i < TOUCH_GAP - 1; i++) {
    touch(sim, 'you')
    wait(sim, i)
  }
  expect(sim.rally).toMatchObject({ touchSide: 'you', touches: 1 })

  wait(sim, TOUCH_GAP)
  touch(sim, 'you')
  expect(sim.rally).toMatchObject({ touchSide: 'you', touches: 2 })
})

test('sim: a touch by the other side starts the count again', () => {
  const sim = newSim(110, 'you')
  for (let i = 0; i < 3; i++) {
    touch(sim, 'you')
    wait(sim, TOUCH_GAP)
  }
  expect(touch(sim, 'claude')).toEqual({ scored: null, hit: 'claude' })
  expect(sim.rally).toMatchObject({ touchSide: 'claude', touches: 1 })

  wait(sim, TOUCH_GAP)
  expect(touch(sim, 'you')).toEqual({ scored: null, hit: 'you' })
  expect(sim.rally).toMatchObject({ touchSide: 'you', touches: 1 })
})

test('sim: the side the ball lands on loses the point', () => {
  const sim = newSim(110, 'you')
  throwBall(sim, 20, 3.1, 0, -10)
  expect(step(sim, STILL).scored).toBe('claude')
  expect(sim.ball.y).toBe(BALL_R)

  throwBall(sim, 90, 3.1, 0, -10)
  expect(step(sim, STILL).scored).toBe('you')
})
