import { expect, test } from 'claude-code/testing'

import { DT, runSpeed } from '../core/constants'
import { newGame, newMatch } from '../core/game'
import { KEY_BITS, KeysSource, PointerSource, STAND } from '../core/input'
import { blobRange, homeX, step } from '../core/sim'

const game = (w: number) => newGame({ w, match: newMatch(), seed: 1 })

test('input: held keys give run and jump; Esc and the foreground bit move nothing', () => {
  const keys = new KeysSource()
  const cases: [mask: number, run: number, jump: boolean][] = [
    [0, 0, false],
    [KEY_BITS.left, -1, false],
    [KEY_BITS.right, 1, false],
    [KEY_BITS.left | KEY_BITS.right, 0, false],
    [KEY_BITS.jump, 0, true],
    [KEY_BITS.right | KEY_BITS.jump | KEY_BITS.front, 1, true],
    [KEY_BITS.esc | KEY_BITS.front, 0, false],
  ]
  for (const [mask, run, jump] of cases) {
    keys.mask = mask
    expect(keys.next()).toEqual({ run, jump })
  }
})

test('input: with no pointer over the court the blob stands, and the button still jumps', () => {
  const pointer = new PointerSource()
  expect(pointer.next(game(110), 'you')).toEqual({ run: 0, jump: false })

  pointer.button = true
  expect(pointer.next(game(110), 'you')).toEqual({ run: 0, jump: true })
})

test('input: the pointer runs the blob at full speed onto its column and keeps it there', () => {
  for (const w of [60, 110, 160]) {
    const g = game(w)
    const pointer = new PointerSource()
    // Inside your half at every width (at 60 it ends at 25).
    pointer.column = homeX(w, 'you') + 7.3
    const needed = Math.ceil(7.3 / (runSpeed(w) * DT))
    const runs: number[] = []
    for (let i = 0; i < needed + 50; i++) {
      const input = pointer.next(g, 'you')
      runs.push(input.run)
      step(g.sim, { you: input, claude: STAND })
      if (i >= needed - 1) expect(Math.abs(g.sim.blobs.you.x - pointer.column)).toBeLessThan(1e-9)
    }
    expect(runs.slice(0, needed - 1).every(run => run === 1)).toBe(true)
    expect(runs.every(run => run >= -1 && run <= 1)).toBe(true)
  }
})

test('input: a pointer across the net leaves the blob at its edge of the net', () => {
  const g = game(110)
  const pointer = new PointerSource()
  pointer.column = homeX(110, 'claude')
  for (let i = 0; i < 200; i++) step(g.sim, { you: pointer.next(g, 'you'), claude: STAND })

  expect(g.sim.blobs.you.x).toBe(blobRange(110, 'you').max)
})
