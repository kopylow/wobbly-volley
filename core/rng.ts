// Seeded generator (xorshift32). Its whole state is one number kept inside the game, so a copied
// game draws the same values. The core never calls Math.random.

const ZERO_SEED = 0x9e3779b9

/** A usable state from any seed: xorshift stays at 0 for ever, so 0 is replaced. */
export function seedRng(seed: number): number {
  return seed >>> 0 || ZERO_SEED
}

/** Advances the holder's state and returns a value in [0, 1). */
export function random(holder: { rng: number }): number {
  let x = holder.rng
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  holder.rng = x >>> 0

  return holder.rng / 0x100000000
}
