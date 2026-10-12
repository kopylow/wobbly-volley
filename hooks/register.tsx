import type { EngineInterface, Register, Timer } from 'claude-code'

import { LEVELS } from '../core/ai'
import type { LevelName } from '../core/ai'
import { MAX_W, TEXT_ROWS } from '../core/constants'
import { courtSize } from '../core/draw'
import { newMatch } from '../core/game'
import type { VolleyBand, VolleyMatch, VolleyRecord, VolleyTurn } from '../types'
import { KeyFeed, LineReader, NO_HELPER, helperArgv, helperScript, parseLine, pickSystem, stopped } from './keys'
import { afterLoad, readSettings } from './lifecycle'
import { readMatch, readRecord, readReport } from './protocol'
import type { CourtProps, CourtReport } from './protocol'
import { HIDDEN as HIDDEN_TEXT, MUTED, NO_RECORD, SHOWN, readArgs, resetLine, same, statsLine, tally, usage } from './standing'

// Kept equal to "version" in .claude-plugin/plugin.json: $.plugin carries no version.
export const VERSION = '1.0.0'

const BAND = { plugin: 'wobbly-volley', key: 'band' } as const
const MATCH = { plugin: 'wobbly-volley', key: 'match' } as const
const RECORD = { plugin: 'wobbly-volley', key: 'record' } as const
const TURN = { plugin: 'wobbly-volley', key: 'turn' } as const
const HIDDEN: VolleyBand = { mode: 'hidden', muted: false, manual: false }
/** The store's keys (PLAN.md 6.11): the standing and the all time record, across sessions. */
const SAVED_MATCH = 'match'
const SAVED_RECORD = 'record'
/**
 * The court counts as mounted while it posted within this time: hidden, collapsed or behind a
 * dialog it posts nothing. The helper stops once it has not posted for this long.
 */
const NO_POSTS_MS = 1000
/** How often the helper's watch looks at its heartbeat and at the court's posts. */
const WATCH_MS = 500
/** After a turn end the court has this long to let its rally run out (10 s of play) and say so. */
const CLOSE_MS = 11000

/** The key helper's process (PLAN.md 6.12). */
type Helper = {
  /** How to start it, looked up once: undefined until then, null where none ships. */
  argv: string[] | null | undefined
  running: boolean
  /** Asked to stop: the loop leaves at the next piece of output, which the heartbeat brings. */
  stopping: boolean
  /**
   * Why no helper reads keys in this module load, or null: none ships for the system, or it ended
   * by itself (an `E` line, a crash). The band then says so in place of the court (D3).
   */
  absent: string | null
}

/** What the module keeps between its hooks, lost on a reload by design (PLAN.md 6.11). */
type Shell = {
  /** The court's seed, drawn each time the court opens. */
  seed: number
  /** The latest command for the court; its `seq` only ever rises, across reloads too. */
  cmd: CourtProps['cmd']
  /** Reports are taken one after another, so a match end is counted once. */
  taking: Promise<void>
  keys: KeyFeed
  helper: Helper
  /** When the court last posted, on the hooks module's clock. */
  lastPost: number
  /** Set while the court lets its rally run out after a turn end (D5): a close is pending. */
  closing: Timer | null
  /** What a store write could not save yet: the next save and the session's end try it again. */
  unsaved: Partial<Standing>
}

type Standing = { match: VolleyMatch; record: VolleyRecord }

/** The court's props, from the session's standing, the level of /config and the module's own values (PLAN.md 6.10). */
async function courtProps($: EngineInterface, shell: Shell, level: LevelName): Promise<CourtProps> {
  const { value: match = newMatch() } = await $.state.get(MATCH)
  const { value: record = NO_RECORD } = await $.state.get(RECORD)
  const { value: turn } = await $.state.get(TURN)
  const test = await $.env.get('WOBBLY_VOLLEY_CLOCK')
  const clock = test === 'tick' || test === 'away' ? test : 'wall'

  return { v: 1, match, record, level, cmd: shell.cmd, doneSeq: turn?.doneSeq ?? 0, keys: shell.keys.state, clock, seed: shell.seed }
}

/** What the store keeps; a value of another shape or with an unknown `v` reads as none (PLAN.md 6.11). */
async function saved($: EngineInterface): Promise<{ match: VolleyMatch | null; record: VolleyRecord | null }> {
  try {
    return { match: readMatch(await $.store.get(SAVED_MATCH)), record: readRecord(await $.store.get(SAVED_RECORD)) }
  } catch (err) {
    $.ui.log(`reading the saved standing failed: ${String(err)}`, { to: 'debug' })
    return { match: null, record: null }
  }
}

/**
 * The session's standing. Where `$.state` holds no match, the saved one comes in, else a fresh one:
 * in a new process, and after /clear, which empties the state and raises no session.start (PLAN.md
 * 6.11). Every path that opens the court or takes a report comes through here first, so the band
 * never draws from an empty state. The record needs no such care: the court's opening and every
 * reader of the record take it from the store (`allTime`), with this one as the fallback.
 */
async function standing($: EngineInterface): Promise<Standing> {
  const { value: record = NO_RECORD } = await $.state.get(RECORD)
  const { value: match } = await $.state.get(MATCH)
  if (match !== undefined) return { match, record }

  const held = (await saved($)).match ?? newMatch()
  await $.state.set(MATCH, held)

  return { match: held, record }
}

/**
 * Writes to the store (PLAN.md 6.11). A write that fails stays pending, for the next save and the
 * session's end; it never fails the hook, which still has the court to answer.
 */
async function save($: EngineInterface, shell: Shell, values: Partial<Standing>): Promise<void> {
  const todo = { ...shell.unsaved, ...values }
  try {
    if (todo.match !== undefined) await $.store.set(SAVED_MATCH, todo.match)
    if (todo.record !== undefined) await $.store.set(SAVED_RECORD, todo.record)
    shell.unsaved = {}
  } catch (err) {
    shell.unsaved = todo
    $.ui.log(`saving the standing failed: ${String(err)}`, { to: 'debug' })
  }
}

/**
 * The all time record: the store's, which other sessions raise too (PLAN.md 3.2), unless this
 * session's own is still pending; `held` where the store has none.
 */
async function allTime($: EngineInterface, shell: Shell, held: VolleyRecord): Promise<VolleyRecord> {
  return shell.unsaved.record ?? (await saved($)).record ?? held
}

/** The court opens: a new seed, and the score row shows what other sessions counted since. */
async function opening($: EngineInterface, shell: Shell, held: VolleyRecord): Promise<void> {
  shell.seed = (await $.clock.now()) >>> 0
  await $.state.set(RECORD, await allTime($, shell, held))
}

/**
 * Takes a report's standing into the session and the store. When the match number went up by one,
 * the match before it ended as `lastMatch` says, and the record counts it; the number makes that
 * happen once, whichever court instance or module load sends the report. A court behind the
 * session's number has not yet taken up the new match of a reset, which its next props bring.
 */
async function take($: EngineInterface, shell: Shell, report: CourtReport): Promise<void> {
  const { match, record } = await standing($)
  if (report.match.number < match.number || same(match, report.match)) return

  const values: Partial<Standing> = { match: report.match }
  if (report.lastMatch !== null && report.match.number === match.number + 1) {
    values.record = tally(await allTime($, shell, record), report.lastMatch)
    await $.state.set(RECORD, values.record)
  }
  await $.state.set(MATCH, report.match)
  await save($, shell, values)
}

/**
 * The delay of the turn `id` ran out (D4): the court opens, waiting for a click, if that turn still
 * runs and the band is free and not muted. A timer of a turn that ended, or of one a reload armed
 * again, finds another turn or none and does nothing.
 */
async function appear($: EngineInterface, shell: Shell, id: string): Promise<void> {
  const { value: turn } = await $.state.get(TURN)
  const { value: band = HIDDEN } = await $.state.get(BAND)
  if (turn?.id !== id || !turn.working || band.mode !== 'hidden' || band.muted) return
  const { record } = await standing($)
  await opening($, shell, record)
  await $.state.set(BAND, { ...band, mode: 'court', manual: false })
}

/** Closes a court that opened by itself; the standing stays in `$.state`. A /volley court stays. */
async function close($: EngineInterface, shell: Shell): Promise<void> {
  shell.closing?.cancel()
  shell.closing = null
  const { value: band = HIDDEN } = await $.state.get(BAND)
  if (band.mode === 'court' && !band.manual) await $.state.set(BAND, { ...band, mode: 'hidden' })
}

/**
 * The turn ended under a court that opened by itself (D5). One that posts lets its rally run out and
 * says so, within CLOSE_MS; one that went silent runs no rally and closes at once. A fresh load has
 * not heard from the court yet (a turn that saved a file in the plugin's folder reloads the module as
 * it ends, 5.1 row 27): one that is there posts within NO_POSTS_MS, one that does not closes then.
 */
async function finish($: EngineInterface, shell: Shell): Promise<void> {
  shell.closing?.cancel()
  shell.closing = null
  const heard = shell.lastPost > -Infinity
  if (heard && !(await mounted($, shell))) return close($, shell)

  const pending = $.clock.after(CLOSE_MS, () => close($, shell))
  shell.closing = pending
  if (heard) return
  $.clock.after(NO_POSTS_MS, async () => {
    // A turn that started meanwhile cancelled this close, and so did a close that came first.
    if (shell.closing === pending && !(await mounted($, shell))) await close($, shell)
  })
}

/** The court posts while it is mounted; collapsed, behind a dialog or replaced by a line it does not. */
async function mounted($: EngineInterface, shell: Shell): Promise<boolean> {
  return (await $.clock.now()) - shell.lastPost <= NO_POSTS_MS
}

/** The court's rally after the last turn end is over. */
async function over($: EngineInterface, report: CourtReport): Promise<boolean> {
  const { value: turn } = await $.state.get(TURN)

  return turn !== undefined && report.closed >= turn.doneSeq
}

/** The Windows path of a file seen from WSL, or null where `wslpath` cannot give one. */
async function windowsPath($: EngineInterface, path: string): Promise<string | null> {
  try {
    const { exitCode, stdout } = await $.process.run(['wslpath', '-w', path], { timeoutMs: 5000 })
    const found = stdout.trim()
    if (exitCode === 0 && found !== '') return found
    $.ui.log(`wslpath gave exit ${exitCode} for ${path}`, { to: 'debug' })
  } catch (err) {
    $.ui.log(`wslpath failed: ${String(err)}`, { to: 'debug' })
  }

  return null
}

/** The helper for this system, looked up once; where none ships or it has no script path, the band says so. */
async function lookUp($: EngineInterface, shell: Shell): Promise<string[] | null> {
  const { helper } = shell
  if (helper.argv === undefined) {
    // Each name is spelled out: the engine lists the variables a module reads.
    let os: string | undefined
    let distro: string | undefined
    try {
      os = await $.env.get('OS')
      distro = await $.env.get('WSL_DISTRO_NAME')
    } catch {
      // What cannot be read counts as unset.
    }
    const system = pickSystem(os, distro)
    const script = helperScript($.plugin.root)
    // powershell.exe takes the script by its Windows path (PLAN.md 6.12).
    const path = system === 'wsl' ? await windowsPath($, script) : script
    helper.argv = path === null ? null : helperArgv(system, path)
    if (path === null) helper.absent = 'it could not start'
    else if (helper.argv === null) helper.absent = NO_HELPER
  }

  return helper.argv
}

/** Starts the helper for a court that posts. */
async function wantHelper($: EngineInterface, shell: Shell): Promise<void> {
  const { helper } = shell
  shell.lastPost = await $.clock.now()
  if (helper.running || helper.absent !== null) return
  const argv = await lookUp($, shell)
  if (argv === null) return
  helper.running = true
  // From a timer, so no hook waits on the loop: it runs for as long as the helper does.
  $.clock.after(0, () => runHelper($, shell, argv))
}

/** Reads the helper's lines into the key state until it ends or is asked to stop (PLAN.md 6.12). */
async function runHelper($: EngineInterface, shell: Shell, argv: string[]): Promise<void> {
  const { helper, keys } = shell
  const reader = new LineReader()
  const watch = $.clock.every(WATCH_MS, () => watchHelper($, shell))
  try {
    const stream = $.process.spawn({ argv })
    // Leaving the loop early rejects the result; nobody waits on it then.
    stream.result.catch(() => undefined)
    for await (const piece of stream) {
      if (piece.stream === 'stdout') {
        const now = await $.clock.now()
        for (const line of reader.push(piece.text)) keys.take(parseLine(line), now)
      }
      // Leaving the loop ends the helper; its heartbeat brings a piece at least every 500 ms.
      if (helper.stopping) break
    }
    if (!helper.stopping) helper.absent = stopped(keys.word)
  } catch (err) {
    $.ui.log(`key helper failed: ${String(err)}`, { to: 'debug' })
    helper.absent = 'it could not start'
  } finally {
    // The band draws the reason in place of the court.
    if (helper.absent !== null) $.ui.invalidate('ui.render')
    watch.cancel()
    keys.end()
    helper.running = false
    helper.stopping = false
  }
}

async function watchHelper($: EngineInterface, shell: Shell): Promise<void> {
  const now = await $.clock.now()
  shell.keys.check(now)
  if (now - shell.lastPost > NO_POSTS_MS) shell.helper.stopping = true
}

export const register: Register = (on, options) => {
  const settings = readSettings(options)
  const shell: Shell = {
    seed: 0,
    cmd: { seq: 0, kind: 'none' },
    taking: Promise.resolve(),
    keys: new KeyFeed(),
    helper: { argv: undefined, running: false, stopping: false, absent: null },
    lastPost: -Infinity,
    closing: null,
    unsaved: {},
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'volley',
      description: 'Wobbly Volley: show or hide the court',
      argumentHint: '[on|off|reset|stats]',
      immediate: true,
    })
    // A new process takes in the saved standing; a reload keeps the session's own.
    await standing($)

    // Also at every reload, which drops the timers: the band and the turn say where things stand.
    const { value: turn } = await $.state.get(TURN)
    const { value: band = HIDDEN } = await $.state.get(BAND)
    const after = afterLoad({ turn, band, settings, now: await $.clock.now() })
    if (after.kind === 'close') await close($, shell)
    else if (after.kind === 'finish') await finish($, shell)
    else if (after.kind === 'arm' && turn !== undefined) $.clock.after(after.ms, () => appear($, shell, turn.id))

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    // A court whose rally still runs out after the last turn stays for this one: a close is pending
    // only between a turn end and the next turn, which is what ui.message and the backstop rely on.
    shell.closing?.cancel()
    shell.closing = null
    const { value: turn } = await $.state.get(TURN)
    await $.state.set(TURN, { id: e.turnId, startedAt: await $.clock.now(), working: true, doneSeq: turn?.doneSeq ?? 0 })
    if (settings.enabled) $.clock.after(settings.delayMs, () => appear($, shell, e.turnId))

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    // A subagent's turn is not the one the person waits for.
    if (e.agentId !== undefined) return next(e)

    const { value: turn = { id: e.turnId, startedAt: 0, working: false, doneSeq: 0 } } = await $.state.get(TURN)
    const { value: band = HIDDEN } = await $.state.get(BAND)
    // Only a court that opened by itself closes; one /volley opened never sees the turn end (3.2).
    const auto = band.mode === 'court' && !band.manual
    const ended: VolleyTurn = { ...turn, working: false, doneSeq: turn.doneSeq + (auto ? 1 : 0) }
    await $.state.set(TURN, ended)
    if (auto) await finish($, shell)

    return next(e)
  })

  on('command.run', { command: 'volley' }, async ($, e) => {
    const word = readArgs(e.args)
    if (word === null) return { text: usage(VERSION) }
    const { match, record } = await standing($)
    const { value: band = HIDDEN } = await $.state.get(BAND)

    switch (word) {
      case 'stats':
        return { text: statsLine(match, await allTime($, shell, record), LEVELS[settings.level].player) }
      case 'reset': {
        // A shown court takes the new match up from its props by the higher number (PLAN.md 6.8).
        const fresh = newMatch(match.number + 1)
        await $.state.set(MATCH, fresh)
        await save($, shell, { match: fresh })
        return { text: resetLine(fresh) }
      }
      case 'off':
        // Hidden, also a court that lets its rally run out, and no court opens by itself until
        // /volley on or a new session (PLAN.md 3.2).
        await $.state.set(BAND, { ...band, mode: 'hidden', muted: true })
        return { text: MUTED }
      case 'on':
        // A court /volley shows stays until it is toggled off, also past a turn end (PLAN.md 3.2).
        await opening($, shell, record)
        await $.state.set(BAND, { ...band, mode: 'court', muted: false, manual: true })
        return { text: SHOWN }
      case 'toggle': {
        // At any time, muted or not; the mute stays as it is.
        const show = band.mode !== 'court'
        if (show) await opening($, shell, record)
        await $.state.set(BAND, { ...band, mode: show ? 'court' : 'hidden', manual: show })
        return { text: show ? SHOWN : HIDDEN_TEXT }
      }
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' || e.props.hasSurvey) return next(e)
    // Reading the state here subscribes the drawing: a toggle or a point draws it again.
    const { value: band = HIDDEN } = await $.state.get(BAND)
    if (band.mode !== 'court') return next(e)

    const { Box, Client, Text } = $.ui.resolve(e)
    // Without the helper no key moves the blob, so there is no game here: one line says why (D3).
    await lookUp($, shell)
    const { absent } = shell.helper
    if (absent !== null) {
      return (
        <Box>
          <Text wrap="truncate">{`Wobbly Volley needs its key helper to read held keys, and ${absent}.`}</Text>
        </Box>
      )
    }

    const { bodyColumns, maxRows } = e.props
    const size = courtSize(bodyColumns, maxRows)
    // Without room for the court the Client stays, one row high: it shows the line of PLAN.md 3.2
    // and pauses the game. Left out, it would come back as a new instance with a new rally.
    const [width, height] = typeof size === 'object' ? [size.columns, size.rows + TEXT_ROWS] : [Math.min(MAX_W, bodyColumns), 1]
    const props = await courtProps($, shell, settings.level)

    return (
      <Box>
        <Client key="court" module="./court.tsx" props={props} width={width} height={height} />
      </Box>
    )
  })

  on('ui.message', async ($, e, next) => {
    if (e.element !== 'court') return next(e)
    const report = readReport(e.data)
    if (report !== null) {
      // The court posts while it is mounted, so its posts are what keeps the helper running.
      await wantHelper($, shell)
      const taken = shell.taking.then(() => take($, shell, report))
      // A failed take fails this hook only; the next report tries again.
      shell.taking = taken.catch(() => undefined)
      await taken
      // The rally after the turn end ran out: the court closes (D5).
      if (shell.closing !== null && (await over($, report))) await close($, shell)
    }

    // The answer hands the court its next props with no render pass (PLAN.md 6.9).
    return { props: await courtProps($, shell, settings.level) }
  })

  on('prompt.edit', ($, e, next) => {
    // The person types into the prompt, so the court lost the keyboard: it pauses (PLAN.md 3.2).
    // Raised for every edit, with no read in the way of typing; a court mounted later takes the
    // command as already seen. The time keeps `seq` rising past a reload.
    shell.cmd = { seq: Math.max(shell.cmd.seq + 1, Date.now()), kind: 'pause' }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // Every point is saved as it comes; only a write that failed is tried once more. A blind save
    // would put this session's standing over a newer one another session saved since (PLAN.md 3.2).
    await shell.taking
    await save($, shell, {})

    return next(e)
  })

  on('ui.fault', async ($, e, next) => {
    // A court that failed stays away until /volley shows it again (PLAN.md 6.9).
    $.ui.log(`court failed while ${e.phase}: ${e.reason}`, { to: 'debug' })
    const { value: band = HIDDEN } = await $.state.get(BAND)
    await $.state.set(BAND, { ...band, mode: 'hidden', manual: false })

    return next(e)
  })
}
