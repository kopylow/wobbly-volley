// Helpers shared by the core tests. Not a test file itself: the kit runs only *.test.ts.

import { STAND } from '../core/input'
import { random, seedRng } from '../core/rng'
import { SIDES } from '../core/sim'
import type { Input, Inputs, Side } from '../core/types'

export const STILL: Inputs = { you: STAND, claude: STAND }

/** Both sides do the given input; the other side stands. */
export function only(side: Side, input: Input): Inputs {
  return { ...STILL, [side]: input }
}

/**
 * Random play from a seed: each side keeps its input for a while (one change in ten steps), so
 * blobs reach the walls and the net and jumps are held for a varying time. A fifth of the runs
 * are fractions, as the AI's will be.
 */
export function chaos(seed: number): () => Inputs {
  const holder = { rng: seedRng(seed) }
  const current: Inputs = { you: STAND, claude: STAND }
  const pick = (): Input => {
    const r = random(holder)
    const run = r < 0.4 ? -1 : r < 0.8 ? 1 : random(holder) * 2 - 1

    return { run, jump: random(holder) < 0.5 }
  }

  return () => {
    for (const side of SIDES) if (random(holder) < 0.1) current[side] = pick()

    return { you: current.you, claude: current.claude }
  }
}
