import { expect, test } from 'claude-code/testing'

import { random, seedRng } from '../core/rng'

const draw = (seed: number, n: number) => {
  const holder = { rng: seedRng(seed) }

  return Array.from({ length: n }, () => random(holder))
}

test('rng: the same seed gives the same sequence', () => {
  expect(draw(42, 100)).toEqual(draw(42, 100))
  expect(draw(42, 100)).not.toEqual(draw(43, 100))
})

test('rng: seed 0 does not stick at 0', () => {
  const values = draw(0, 10)

  expect(values.some(v => v > 0)).toBe(true)
})

test('rng: values lie in [0, 1) and spread evenly', () => {
  const values = draw(7, 10_000)
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length

  expect(values.every(v => v >= 0 && v < 1)).toBe(true)
  expect(mean).toBeGreaterThan(0.47)
  expect(mean).toBeLessThan(0.53)
})
