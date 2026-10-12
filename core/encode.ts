import { SKY } from './draw'
import type { Frame, Weight } from './draw'

// Frame to output (PLAN.md 6.7), the one place a frame becomes something drawn (D2): rows of text
// runs for the Client. A cell holds two pixels as a half block, and the sky sets no colour.

/**
 * A stretch of one row in one colour pair; without `fg` it is plain text on the terminal's own. A
 * pulsing line's cells carry its `weight` (PLAN.md 6.7).
 */
export type Run = { text: string; fg?: string; bg?: string; weight?: Weight }

/**
 * Coloured runs a frame may hold. One serializes to at most 85 characters plus its text (PLAN.md
 * 5.1), so a 160 x 24 court stays near 85,000 of the Client's 100,000; past the budget the rest of
 * the frame is drawn blank. A real frame needs about 30.
 */
export const MAX_COLORED_RUNS = 900

/** The half block for a cell and its colours, by the upper and the lower pixel. */
function cell(top: number, bottom: number): [char: string, fg: number, bg: number] {
  if (top === SKY) return bottom === SKY ? [' ', SKY, SKY] : ['▄', bottom, SKY]
  if (bottom === SKY) return ['▀', top, SKY]
  if (top === bottom) return ['█', top, SKY]

  return ['▀', top, bottom]
}

export function encodeRuns(frame: Frame, palette: readonly (string | null)[]): Run[][] {
  const { w, h, px } = frame
  const chars = new Array<string>(w)
  const fgs = new Array<number>(w)
  const bgs = new Array<number>(w)
  const weights = new Array<Weight | undefined>(w)
  let budget = MAX_COLORED_RUNS
  const out: Run[][] = []

  for (let row = 0; row < h / 2; row++) {
    for (let x = 0; x < w; x++) {
      const [c, f, b] = cell(px[2 * row * w + x] ?? SKY, px[(2 * row + 1) * w + x] ?? SKY)
      chars[x] = c
      fgs[x] = f
      bgs[x] = b
      weights[x] = undefined
    }
    for (const o of frame.overlays) {
      if (o.row !== row) continue
      for (let i = 0; i < o.text.length; i++) {
        const x = o.col + i
        if (x < 0 || x >= w) continue
        chars[x] = o.text[i] ?? ' '
        fgs[x] = o.color
        bgs[x] = SKY
        weights[x] = o.weight
      }
    }

    const runs: Run[] = []
    let text = ''
    let fg = SKY
    let bg = SKY
    let weight: Weight | undefined
    const flush = () => {
      if (text === '') return
      const run: Run = { text }
      const fgColor = palette[fg]
      const bgColor = palette[bg]
      if (fgColor) run.fg = fgColor
      if (fgColor && bgColor) run.bg = bgColor
      if (weight !== undefined) run.weight = weight
      runs.push(run)
    }
    for (let x = 0; x < w; x++) {
      let f = fgs[x] ?? SKY
      let b = bgs[x] ?? SKY
      let c = chars[x] ?? ' '
      let wt = weights[x]
      if (f === fg && b === bg && wt === weight) {
        text += c
        continue
      }
      if (f !== SKY && budget <= 0) {
        // No room for another coloured run: the cell stays blank.
        f = SKY
        b = SKY
        c = ' '
        wt = undefined
        if (fg === SKY && weight === undefined) {
          text += c
          continue
        }
      }
      flush()
      if (f !== SKY) budget--
      text = c
      fg = f
      bg = b
      weight = wt
    }
    flush()
    out.push(runs)
  }

  return out
}
