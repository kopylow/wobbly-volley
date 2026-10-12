// The game's state and the values passed in and out of it (PLAN.md 6.3 to 6.5). Every state value
// is plain JSON, so a game survives structuredClone, a remount and, later, a network copy.

/** You play on the left, Claude on the right. */
export type Side = 'you' | 'claude'

/** What one side does in one step: `run` from -1 (left) to 1 (right), clamped by the sim. */
export type Input = { run: number; jump: boolean }
export type Inputs = Record<Side, Input>

/**
 * `x` is the bottom centre of the body, `y` its feet; on the ground when `y` is 0. `wobble` counts
 * the steps into its wobble, 0 at rest; only the drawing reads it.
 */
export type Blob = { x: number; y: number; vy: number; wobble: number }

/** `x`, `y` is the centre. A hovering ball waits for the serve and does not move. */
export type Ball = { x: number; y: number; vx: number; vy: number; hover: boolean }

export type Rally = {
  server: Side
  /** The side the touches below belong to; null before the first touch. */
  touchSide: Side | null
  touches: number
  /** Contact free steps since each blob last touched the ball. */
  gap: Record<Side, number>
}

export type Sim = { w: number; blobs: Record<Side, Blob>; ball: Ball; rally: Rally }

export type StepResult = { scored: Side | null; hit: Side | null }

export type Phase = 'idle' | 'countdown' | 'rally' | 'point' | 'matchEnd' | 'paused'

/** The standing; the same shape as `VolleyMatch` in types/index.d.ts (a test holds them equal). */
export type Match = { v: 1; you: number; claude: number; server: Side; number: number }

export type MatchResult = { winner: Side; you: number; claude: number }

export type Game = {
  phase: Phase
  /** Steps left in a timed phase (countdown, point, matchEnd). */
  timer: number
  sim: Sim
  match: Match
  rng: number
  /** Steps the rally may still run after the turn ended; null while no turn end is pending. */
  cut: number | null
  lastPoint: Side | null
  lastMatch: MatchResult | null
}

export type Action =
  | { kind: 'start' }
  | { kind: 'pause' }
  | { kind: 'turnDone' }
  /** A new match, as the shell started it (/volley reset): 0:0, number plus one (PLAN.md 6.4). */
  | { kind: 'reset'; match: Match }
  | { kind: 'resize'; w: number }

export type GameEvent = { kind: 'point'; side: Side } | { kind: 'matchEnd'; winner: Side } | { kind: 'rallyOver' }
