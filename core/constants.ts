// Every tunable number of the game (PLAN.md 6.3, 6.4). Derived from Blobby Volley's proportions at
// roughly one tenth scale; open to tuning in M10. Lengths are world pixels: one column wide, half a
// row tall.

/** One fixed step of the simulation, in seconds. */
export const DT = 1 / 60

export const BLOB_W = 8
export const BLOB_H = 8.5
/** The blob's collision shape: two circles, centres given above the feet. */
export const BLOB_CIRCLES = [
  { dy: 3.4, r: 3.4 },
  { dy: 6.2, r: 2.4 },
] as const
/** Steps of one wobble, a squash and back, which walking keeps going (PLAN.md 6.7). */
export const WOBBLE_STEPS = 16
/** The winner hops on the win screen: steps of one hop, and how high it rises (PLAN.md 6.7). */
export const HOP_STEPS = 30
export const HOP_PX = 6

export const BALL_R = 3
export const NET_H = 17
/** Half width of the net, which is also the radius of its round top. */
export const NET_R = 1

/** Seconds a blob needs to cross its own half. */
export const RUN_TIME = 1.3
export const JUMP_SPEED = 109
/** While rising with jump held (apex about 23 px at 60 steps a second). */
export const GRAVITY_HELD = 247
/** Otherwise (a tap reaches about 16 px). */
export const GRAVITY = 370
export const BALL_GRAVITY = 155
/** Share of the court a 45 degree hit flies. */
export const HIT_RANGE = 0.75

/** Height of the ball hovering for the serve. */
export const SERVE_Y = 26
/** Contact free steps before a new touch counts. */
export const TOUCH_GAP = 6
/** Touches per side per possession; one more scores for the other side. */
export const MAX_TOUCHES = 3

/** The court is as wide as the band, within these limits (PLAN.md 3.2). */
export const MIN_W = 60
export const MAX_W = 160

/** Court rows in the band; a short band shrinks the court down to MIN_COURT_ROWS (PLAN.md 3.2). */
export const COURT_ROWS = 24
export const MIN_COURT_ROWS = 16
/** The score row above the court and the hint row below it. */
export const TEXT_ROWS = 2
/** Pixels of ground under the feet; halved on a court too short for the hovering serve (PLAN.md 6.7). */
export const GROUND_PX = 4

export const WIN_POINTS = 11
export const WIN_BY = 2

// Phase lengths in steps: the core never reads a clock.
export const BEAT_STEPS = 30
export const COUNTDOWN_BEATS = 3
export const COUNTDOWN_STEPS = BEAT_STEPS * COUNTDOWN_BEATS
export const POINT_STEPS = 60
export const MATCH_END_STEPS = 180
/** How long the rally may run on after the turn ended (D5). */
export const DONE_CUT_STEPS = 600

export function clampWidth(columns: number): number {
  return Math.min(MAX_W, Math.max(MIN_W, Math.round(columns)))
}

export function runSpeed(w: number): number {
  return w / 2 / RUN_TIME
}

/** Every blob hit sets the ball to this speed, so a 45 degree hit flies HIT_RANGE of the court. */
export function hitSpeed(w: number): number {
  return Math.sqrt(HIT_RANGE * w * BALL_GRAVITY)
}
