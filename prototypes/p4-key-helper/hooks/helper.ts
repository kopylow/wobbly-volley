// The helper's line format (PLAN.md 6.12), read from stdout pieces that end anywhere. No
// `claude-code` import: M6 ports this into the mod's hooks/keys.ts.

export type HelperLine =
  | { kind: 'K'; mask: number; at: number }
  | { kind: 'H'; at: number }
  | { kind: 'E'; word: string }
  | { kind: 'other'; text: string }

const WHOLE = /^\d+$/

export function parseLine(line: string): HelperLine {
  const [head, a, b] = line.trim().split(/\s+/)
  if (head === 'K' && a !== undefined && b !== undefined && WHOLE.test(a) && WHOLE.test(b)) {
    return { kind: 'K', mask: Number(a), at: Number(b) }
  }
  if (head === 'H' && a !== undefined && WHOLE.test(a)) return { kind: 'H', at: Number(a) }
  if (head === 'E' && a !== undefined) return { kind: 'E', word: a }

  return { kind: 'other', text: line }
}

/** Buffers stream text and hands out whole lines; a half line waits for the next piece. */
export class LineReader {
  private rest = ''

  push(text: string): string[] {
    const lines = (this.rest + text).split(/\r?\n/)
    this.rest = lines.pop() ?? ''

    return lines.filter(line => line.trim() !== '')
  }
}

export function describe(values: number[]): string {
  if (values.length === 0) return 'none yet'
  const sorted = [...values].sort((a, b) => a - b)
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? -1

  return `median ${at(0.5)} ms, 95th ${at(0.95)} ms, worst ${at(1)} ms (n ${sorted.length})`
}
