import { DT, runSpeed } from './constants'
import type { Game, Input, Side } from './types'

// One interface for every player (PLAN.md 6.5): the sim gets an Input per side and per step and
// never learns where it came from.

export interface InputSource {
  next(game: Game, side: Side): Input
}

/** The input that does nothing. */
export const STAND: Input = { run: 0, jump: false }

/** The key mask of the helper's K lines (PLAN.md 6.10, 6.12). */
export const KEY_BITS = { left: 1, right: 2, jump: 4, esc: 8, front: 16 } as const

/** Held keys from the helper. Esc and the foreground bit are the armed logic's business (6.8), not the blob's. */
export class KeysSource implements InputSource {
  mask = 0

  next(): Input {
    const left = this.mask & KEY_BITS.left ? 1 : 0
    const right = this.mask & KEY_BITS.right ? 1 : 0

    return { run: right - left, jump: (this.mask & KEY_BITS.jump) !== 0 }
  }
}

/**
 * The pointer: the blob runs toward the pointer's column and the button jumps. Within the last
 * step's reach the run shrinks, so the blob lands on the column instead of jittering around it.
 */
export class PointerSource implements InputSource {
  /** The pointer's position in world pixels, or null while it is not over the court. */
  column: number | null = null
  button = false

  next(game: Game, side: Side): Input {
    if (this.column === null) return { run: 0, jump: this.button }
    const reach = runSpeed(game.sim.w) * DT
    const run = (this.column - game.sim.blobs[side].x) / reach

    return { run: Math.min(1, Math.max(-1, run)), jump: this.button }
  }
}
