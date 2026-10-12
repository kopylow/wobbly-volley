// What the kit tests of the court share; not a test file itself, the kit runs only *.test.ts. The
// engine beneath the plugin, a Windows session whose key helper is a stand-in on the mock clock,
// a store the test can read, and readers of what the court drew. The court's frame clock is the
// band's own (`band.advance`); the hooks module's timers and the helper's lines run on the mock
// clock (PLAN.md 5.1 row 72).

import { expect, mock } from 'claude-code/testing'
import type { Engine, MockClock, Mounted } from 'claude-code/testing'
import type { On, PromptEditInput, RenderPropsOf } from 'claude-code'

import { BLOB_COLOR, PALETTE, messageRow } from '../core/draw'

type BandProps = RenderPropsOf['AbovePrompt']
export type Band = Mounted<'terminal', 'AbovePrompt'>
type Node = { props?: { color?: string; bold?: boolean; dimColor?: boolean }; children?: unknown[] }

export const PROPS: BandProps = {
  isWorking: true,
  maxRows: 29,
  bodyColumns: 110,
  hasSurvey: false,
  scroll: { offset: 0, bodyRows: 29 },
  view: {},
}
export const VIEWPORT = { columns: 115, rows: 70, isFullscreen: true } as const
const TYPED = { origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 115 } } as const
const EDIT: PromptEditInput = { origin: { kind: 'composer' }, text: '', cursor: 0, start: 0, end: 0, inputText: 'a', key: { key: 'a' } }

/** The line of the court's drawing that carries the phase message on a 24 row court. */
export const MESSAGE_LINE = 1 + messageRow(24)
/** The hint row of a 26 row court. */
export const HINT_LINE = 25

/** Masks of the helper's K lines: the terminal in front, and the keys of PLAN.md 6.10. */
export const FRONT = 16
export const KEYS: Record<string, number> = { a: 1, d: 2, w: 4 }
export const ESC = 8

/** The stand-in helper: what it was started with, how often its stream was closed, and its mouth. */
export type Stub = { argv: string[][]; closed: number; say: (text: string) => void }

/**
 * The stand-in store: what the plugin saved; how many of the next writes fail, as on a full disk;
 * whether reads fail, as with a broken file; a gate the writes wait on, and how many came to it;
 * and the writes made.
 */
export type Store = { map: Map<string, unknown>; fail: number; unreadable: boolean; gate: Promise<void> | null; held: number; writes: number }

/** A court in a session, with its band, the mock clock, the stand-in helper and the store. */
export type Kit = { $: Engine; band: Band; clock: MockClock; stub: Stub; store: Store }

/**
 * Answers `process.spawn` as the helper would: the lines the test hands it, in order, and nothing
 * else. It waits on the mock clock, so no act of the kit waits for it. After an `E` line it exits,
 * as the real helper does.
 */
function helper(on: On, clock: MockClock): Stub {
  const queue: string[] = []
  const stub: Stub = { argv: [], closed: 0, say: text => queue.push(text) }
  on('process.spawn', async function* ($, e) {
    stub.argv.push([...e.argv])
    try {
      for (let i = 0; i < 100000; i++) {
        const text = queue.shift()
        if (text === undefined) {
          await clock.sleep(10)
          continue
        }
        yield { stream: 'stdout' as const, text }
        if (text.startsWith('E ')) return { value: { code: 1, signal: null } }
      }
      return { value: { code: 0, signal: null } }
    } finally {
      stub.closed++
    }
  })

  return stub
}

/** The Windows path the stand-in `wslpath -w` gives for any path. */
export const WSL_SCRIPT = 'C:\\projects\\ClaudeyVolley\\helper\\keys.ps1'

/** The stand-in `wslpath`: what it was asked, the exit code it ends with and what it writes; a test sets the last two. */
export type Wslpath = { asked: string[][]; exitCode: number; stdout: string }

/**
 * Answers `process.run` as `wslpath -w` would where it is `there`, in a WSL distribution; elsewhere
 * it fails, as a system without `wslpath` does. Nothing else of the mod runs a process to its end.
 */
function wslpath(on: On, there: boolean): Wslpath {
  const w: Wslpath = { asked: [], exitCode: there ? 0 : 1, stdout: there ? `${WSL_SCRIPT}\n` : '' }
  on('process.run', ($, e) => {
    w.asked.push([...e.argv])

    return {
      value: { exitCode: w.exitCode, stdout: w.stdout, stderr: w.exitCode === 0 ? '' : 'wslpath: no such file', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })

  return w
}

/**
 * Answers `$.store` from a Map the test reads. A test's own `$` has no store, and a hook of its own
 * beside `mock.store` is refused (PLAN.md 5.1), so this one stands in for both.
 */
export function store(on: On, saved: Readonly<Record<string, unknown>> = {}): Store {
  const s: Store = { map: new Map(Object.entries(saved)), fail: 0, unreadable: false, gate: null, held: 0, writes: 0 }
  on('store.get', ($, e) => {
    if (s.unreadable) throw new Error('unreadable')

    return { value: s.map.get(e.key) }
  })
  on('store.set', async ($, e) => {
    if (s.gate !== null) {
      s.held++
      await s.gate
    }
    if (s.fail > 0) {
      s.fail--
      throw new Error('disk full')
    }
    s.writes++
    s.map.set(e.key, structuredClone(e.value))

    return { value: undefined }
  })

  return s
}

/**
 * What lies beneath the plugin in a session: the engine's band, prompt, turns and session end, which
 * draw and change nothing of their own, the test clock of the court, the system (Windows unless `os`
 * is empty; `distro` makes it a WSL distribution), the store with what an earlier session saved, and
 * the mock clock with a fixed time for the court's seed.
 */
export function engine(
  on: On,
  options: { clock?: 'tick' | 'away'; os?: string; distro?: string; saved?: Record<string, unknown> } = {},
): { clock: MockClock; stub: Stub; store: Store; wslpath: Wslpath } {
  on('ui.render', ($, e) => $.ui.resolve(e).Box({}))
  on('prompt.edit', ($, e) => ({ text: e.text, cursor: e.cursor }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  const env: Record<string, string> = { WOBBLY_VOLLEY_CLOCK: options.clock ?? 'tick' }
  if (options.os !== '') env.OS = options.os ?? 'Windows_NT'
  if (options.distro !== undefined) env.WSL_DISTRO_NAME = options.distro
  mock.env(on, env)
  const clock = mock.clock(on, { now: 1 })

  return { clock, stub: helper(on, clock), store: store(on, options.saved), wslpath: wslpath(on, options.distro !== undefined) }
}

/** The engine's own answers to a session starting, as at a load or a reload of the module. */
export function sessions(on: On): ($: Engine) => Promise<unknown> {
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  return $ => $.session.start({ cwd: 'C:/projects/ClaudeyVolley', surface: 'terminal', isInteractive: true })
}

/** A main turn starts. */
export async function turnStart($: Engine, turnId = 't1'): Promise<void> {
  await $.turn.start({ text: 'a long task', turnId })
}

/** A turn ends: the main loop's, or with `agentId` a subagent's. */
export async function turnEnd($: Engine, turnId = 't1', agentId?: string): Promise<void> {
  const end = { answer: 'done', durationMs: 6000, isAborted: false, turnId, reason: 'answer' as const }
  await $.turn.complete(agentId === undefined ? end : { ...end, agentId })
}

/** /volley with a word, typed at the prompt; its answer. */
export async function volley($: Engine, args: string): Promise<string | undefined> {
  return (await $.command.run({ command: 'volley', args, ...TYPED })).text
}

export function toggle($: Engine): Promise<string | undefined> {
  return volley($, '')
}

/** A key typed into the prompt box; the test engine's type does not list `prompt.edit`, the kit has it. */
export async function typeIntoPrompt($: Engine): Promise<void> {
  await ($.prompt as unknown as { edit: (e: PromptEditInput) => Promise<unknown> }).edit(EDIT)
}

export function mount($: Engine, props: Partial<BandProps> = {}): Promise<Band> {
  return $.ui.mount({ plugin: 'wobbly-volley', surface: 'terminal', component: 'AbovePrompt', props: { ...PROPS, ...props }, viewport: VIEWPORT })
}

export function shown(node: unknown): string {
  if (typeof node === 'string') return node
  if (typeof node !== 'object' || node === null) return ''

  return ((node as Node).children ?? []).map(shown).join('')
}

/** The score row, the court rows and the hint row, as text. */
export async function lines(band: Band): Promise<string[]> {
  return (((await band.drawn({ in: 'court' })) as Node).children ?? []).map(shown)
}

/** The court rows without the message line: what play shows, whatever the phase says. */
export async function picture(band: Band): Promise<string[]> {
  return (await lines(band)).slice(1, -1).filter((_, i) => i + 1 !== MESSAGE_LINE)
}

/** The phase message, without what the court draws in the same row (a high ball, the net's top). */
export async function message(band: Band): Promise<string> {
  return ((await lines(band))[MESSAGE_LINE] ?? '').replace(/[▀▄█]/g, ' ').trim()
}

/** How the phase message is drawn now: bold or dim while it pulses, else plain; null without one. */
export async function weight(band: Band): Promise<'bold' | 'dim' | 'plain' | null> {
  const row = (((await band.drawn({ in: 'court' })) as Node).children ?? [])[MESSAGE_LINE] as Node | undefined
  for (const run of row?.children ?? []) {
    if (typeof run === 'string' || !/[^\s▀▄█]/.test(shown(run))) continue
    const { bold, dimColor } = (run as Node).props ?? {}
    return bold === true ? 'bold' : dimColor === true ? 'dim' : 'plain'
  }

  return row === undefined || !/[^\s▀▄█]/.test(shown(row)) ? null : 'plain'
}

/** The columns and court rows your blob covers, read from the colours of the drawn runs. */
export async function blue(band: Band): Promise<{ left: number; right: number; top: number }> {
  // The score row's "You" has the same colour; only the court rows count.
  const rows = (((await band.drawn({ in: 'court' })) as Node).children ?? []).slice(1, -1)
  const found = { left: Infinity, right: -Infinity, top: Infinity }
  rows.forEach((row, y) => {
    let x = 0
    for (const run of (row as Node).children ?? []) {
      const text = shown(run)
      if (typeof run !== 'string' && (run as Node).props?.color === PALETTE[BLOB_COLOR.you]) {
        found.left = Math.min(found.left, x)
        found.right = Math.max(found.right, x + text.length - 1)
        found.top = Math.min(found.top, y)
      }
      x += text.length
    }
  })

  return found
}

export async function centre(band: Band): Promise<number> {
  const { left, right } = await blue(band)

  return (left + right) / 2
}

/** A left click into the court: it starts, resumes and hands the court the keyboard. */
export async function click(band: Band): Promise<void> {
  await band.pointer({ type: 'down', x: 80, y: 12, button: 'left' })
  await band.advance(100)
  await band.pointer({ type: 'up', x: 80, y: 12, button: 'left' })
}

/** The helper writes a line; the mock clock lets it through, and a frame hands the court the result. */
export async function says(k: Kit, text: string): Promise<void> {
  k.stub.say(text)
  await k.clock.advance(20)
  await k.band.advance(32)
}

/**
 * The helper misses its heartbeats for 3 s while the court keeps posting: it is no longer trusted
 * (SILENT_MS), and the posts keep it from being stopped. A frame then hands the court the result.
 */
export async function silence(k: Kit): Promise<void> {
  for (let t = 0; t < 3000; t += 500) {
    await k.clock.advance(500)
    await k.band.advance(16)
  }
}

/** The first frame posts, the post starts the helper, the helper says it is ready and in front. */
export async function started(k: Kit): Promise<void> {
  await k.band.advance(16)
  await k.clock.settle()
  await says(k, `H 1\nK ${FRONT} 1\n`)
}

/**
 * Holds the keys for about `ms` and lets them go: the helper reports them down, the court gets
 * their presses as a terminal with the court focused delivers them, and the helper reports them up.
 * The props a post brings reach the court only when the act that made the post ends (PLAN.md 5.1,
 * kit quirks), so the mask comes in an act of its own before the presses.
 */
export async function hold(k: Kit, keys: string, ms: number): Promise<void> {
  const mask = [...keys].reduce((m, key) => m | (KEYS[key] ?? 0), FRONT)
  await says(k, `K ${mask} 2\n`)
  for (const key of keys) await k.band.key({ key })
  await k.band.advance(ms)
  await says(k, `K ${FRONT} 3\n`)
}

/**
 * From the first click to your serve leaving: the countdown, a short run left so the blob stands
 * about 3 px behind the hovering ball, then a jump that sends it toward the net.
 */
export async function serve(k: Kit): Promise<void> {
  await click(k.band)
  await k.band.advance(1600)
  await hold(k, 'a', 32)
  await hold(k, 'w', 250)
}

/** Advances in steps until the score row leaves 0 : 0, for at most a minute; the seconds it took. */
export async function untilPoint(k: Kit): Promise<number> {
  let seconds = 0
  while (seconds < 60 && (await lines(k.band))[0]?.startsWith('You 0 : 0 ')) {
    await k.band.advance(250)
    seconds += 0.25
  }

  return seconds
}

/** /volley, the court laid out at 110 by 26, and its helper started. */
export async function court($: Engine, on: On, options: { clock?: 'tick' | 'away'; saved?: Record<string, unknown> } = {}): Promise<Kit> {
  const { clock, stub, store } = engine(on, options)
  await toggle($)
  const band = await mount($)
  await band.resize({ columns: 110, rows: 26 })
  const k: Kit = { $, band, clock, stub, store }
  await started(k)

  return k
}

/** A turn runs past the default delay: the court opens by itself, laid out at 110 by 26, its helper started. */
export async function appeared($: Engine, on: On, options: { saved?: Record<string, unknown> } = {}): Promise<Kit> {
  const { clock, stub, store } = engine(on, options)
  const band = await mount($)
  await turnStart($)
  await clock.advance(5000)
  await band.resize({ columns: 110, rows: 26 })
  const k: Kit = { $, band, clock, stub, store }
  await started(k)

  return k
}

/**
 * /volley hides the court and shows it again in a new drawing of the band, whose helper starts
 * again. A Client the band drops and draws again moments later can keep its old instance in the
 * kit (PLAN.md 5.1, kit quirks), so the band is mounted anew: the court that comes back is surely
 * a fresh one.
 */
export async function reopen(k: Kit): Promise<Kit> {
  await toggle(k.$)
  expect(await k.band.findAll({ type: 'Client' })).toHaveLength(0)
  await k.band.unmount()
  await toggle(k.$)
  const band = await mount(k.$)
  await band.resize({ columns: 110, rows: 26 })
  const again: Kit = { ...k, band }
  await again.band.advance(16)
  await again.clock.settle()

  return again
}
