// The key helper as the hooks module sees it (PLAN.md 6.12): which helper a system starts, its
// lines read from stdout pieces that end anywhere, the key state they make, and why a helper cannot
// run. No claude-code import, so tests drive it; the spawn itself needs `$` and lives in register.tsx.

export type HelperLine =
  | { kind: 'K'; mask: number; at: number }
  | { kind: 'H'; at: number }
  | { kind: 'E'; word: string }
  | { kind: 'other'; text: string }

/** What the court gets (PLAN.md 6.10): the mask of 6.12, and whether the helper is to be trusted. */
export type KeyState = { ok: boolean; mask: number }

/** Why no helper reads keys here, as the band says it after "needs its key helper to read held keys, and". */
export const NO_HELPER = 'there is none for this system yet'
const WORDS: Record<string, string> = {
  nowindow: 'it found no terminal window',
  noinput: 'it can read no keyboard',
  nodisplay: 'it found no display',
}

/** Why a helper that ended by itself is gone, from the word of its `E` line if it wrote one. */
export function stopped(word: string | null): string {
  return word === null ? 'it stopped' : (WORDS[word] ?? `it stopped (${word})`)
}

/** A helper silent this long is not trusted; its heartbeat comes every 500 ms. */
export const SILENT_MS = 2000

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

/** Folds the helper's lines into key state. Without a trusted helper the mask is 0, so no key sticks. */
export class KeyFeed {
  state: KeyState = { ok: false, mask: 0 }
  /** The word of the helper's `E` line, once it wrote one. */
  word: string | null = null
  private heard = 0
  /**
   * The helper's last K mask, null before its first: it writes one at its start and then only when
   * the keys change, so the last one holds while the helper lives, through a silence too.
   */
  private mask: number | null = null

  take(line: HelperLine, now: number): void {
    if (line.kind === 'K') this.mask = line.mask
    else if (line.kind === 'E') {
      this.word = line.word
      return this.end()
    } else if (line.kind !== 'H') return
    this.heard = now
    // Its first H comes before its first K: until then nothing is known about the keys or the window.
    if (this.mask !== null) this.state = { ok: true, mask: this.mask }
  }

  /** A helper that missed its heartbeats for SILENT_MS is no longer trusted, until it speaks again. */
  check(now: number): void {
    if (this.state.ok && now - this.heard > SILENT_MS) this.state = { ok: false, mask: 0 }
  }

  /** The helper is gone; the next one starts from nothing. */
  end(): void {
    this.mask = null
    this.state = { ok: false, mask: 0 }
  }
}

/** The systems a helper is picked for (PLAN.md 6.12); `other` has none yet. */
export type System = 'windows' | 'wsl' | 'other'

/** Windows by `OS`, then WSL by its distribution variable; Linux and macOS join once M2b measured them. */
export function pickSystem(os: string | undefined, distro: string | undefined): System {
  if (os === 'Windows_NT') return 'windows'
  if (distro !== undefined && distro !== '') return 'wsl'

  return 'other'
}

/** The Windows helper's script in the mod's folder, joined with the folder's own separator. */
export function helperScript(root: string): string {
  const sep = root.includes('\\') ? '\\' : '/'

  return [root.replace(/[\\/]+$/, ''), 'helper', 'keys.ps1'].join(sep)
}

/**
 * The helper to start for a system, or null where none ships. Windows and WSL passed P4 (D3). WSL
 * runs the Windows helper through `powershell.exe`, since the keyboard of a WSL session is Windows',
 * so there `script` is the Windows path of `helperScript`, as `wslpath -w` gives it. Linux and macOS
 * get theirs once M2b measured them, and have no game until then.
 */
export function helperArgv(system: System, script: string): string[] | null {
  if (system === 'other') return null

  return ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script]
}
