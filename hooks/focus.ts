// Whether the terminal window has the focus, read from the frame clock (PLAN.md 6.8). No API field
// says so, but the clock does: about 58 ticks a second with the focus, a steady 30 to 31 without it,
// back at once on return (P1, P2). Plain TypeScript with no claude-code import, so tests drive it.

/** The background clock's gaps: 32 to 33 ms, now and then outside this band (P1). */
const SLOW_MIN = 26
const SLOW_MAX = 40
/** The last this many gaps are weighed, */
const SPAN = 16
/** this many of them slow means the window went to the background, */
const LEAVE = 12
/** and this few means it came back. Between the two the verdict stands, so it cannot flicker. */
const BACK = 4

export class FocusWatch {
  /** Whether each of the last SPAN gaps was slow, oldest first. */
  private readonly slow: boolean[] = []
  private count = 0
  background = false

  /** Takes the gap before a tick, in ms. True only at the tick the window is found gone. */
  gap(ms: number): boolean {
    const slow = ms >= SLOW_MIN && ms <= SLOW_MAX
    this.slow.push(slow)
    if (slow) this.count++
    if (this.slow.length > SPAN && this.slow.shift()) this.count--
    if (this.slow.length < SPAN) return false

    const was = this.background
    if (this.count >= LEAVE) this.background = true
    else if (this.count <= BACK) this.background = false

    return this.background && !was
  }
}
