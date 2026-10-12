import type { EngineInterface, Register } from 'claude-code'

import { describe, LineReader, parseLine } from './helper'
import type { HelperLine } from './helper'
import type { KeyState, P4Post, P4Props } from './protocol'

// P4 key helper, hooks worker (PLAN.md section 7): picks the key state helper by system (6.12),
// starts it through $.process.spawn on /p4 on, reads its lines, hands the mask to court.tsx in the
// reply to each post (6.9, ui.message), and writes prototypes/results/p4-key-helper-<system>.json.
// A load writes that file only once a /p4 command started something, and then only its own entry,
// so a session left open or moved to the background cannot push out another one's measurements.

type System = 'windows' | 'wsl' | 'linux' | 'macos'

/** One start of the helper. Times are epoch ms of the hooks module's clock. */
type Spawn = {
  n: number
  at: number
  argv: string[]
  firstChunkAt: number | null
  firstHeartbeatAt: number | null
  heartbeats: number
  other: string[]
  stderr: string
  error: string | null
  stopAt: number | null
  stopReason: string | null
  endAt: number | null
  exitCode: number | null
  exitSignal: string | null
}

/**
 * One K line: the helper's stamp, its arrival here and in the Client (null when a later mask got
 * there first). `first` marks a spawn's opening state, which no key press caused.
 */
type KeyRow = {
  seq: number
  spawn: number
  first: boolean
  mask: number
  helperAt: number
  hooksAt: number
  clientAt: number | null
  working: boolean
}

type ClientKey = { at: number; key: string; instance: string }
type Note = { at: number; kind: string; text: string }

type Load = {
  id: string
  session: string
  build: string
  system: System
  loadedAt: number
  savedAt: number
  endedAt: number | null
  keysDropped: number
  spawns: Spawn[]
  notes: Note[]
  keys: KeyRow[]
  clientKeys: ClientKey[]
}

type Results = { v: 1; system: System; loads: Load[] }

/** Everything the hooks share; one object, so top-level functions can take it beside `$`. */
type State = {
  load: Load | undefined
  path: string
  used: boolean
  dirty: boolean
  saving: boolean
  saved: string
  shown: boolean
  working: boolean
  /** The helper loops in order: a start waits until the previous loop has ended. */
  running: Promise<void>
  live: boolean
  stopping: string | null
  spawn: Spawn | undefined
  keys: KeyState
  lastHeartbeat: number
  rows: Map<number, KeyRow>
  instance: string
  acks: Map<string, number>
  lines: string[]
  changed: boolean
}

const KEEP = 5000
const ROWS = 15
const PS = ['powershell.exe', '-NoProfile', '-NonInteractive']
// No double quotes: Windows PowerShell 5.1 drops them from a -Command argument. The pattern is
// built from two pieces, so this command's own line does not match it.
const LIST_HELPERS =
  "Get-CimInstance Win32_Process -Filter 'Name=''powershell.exe''' | " +
  "Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -like ('*keys' + '.ps1*') } | " +
  "ForEach-Object { '{0} started {1:HH:mm:ss}' -f $_.ProcessId, $_.CreationDate }"

function isPost(data: unknown): data is P4Post {
  if (typeof data !== 'object' || data === null) return false
  const post = data as Partial<P4Post>

  return post.v === 1 && typeof post.instance === 'string' && Array.isArray(post.events)
}

function isResults(data: unknown): data is Results {
  if (typeof data !== 'object' || data === null) return false
  const old = data as Partial<Results>

  return old.v === 1 && Array.isArray(old.loads) && old.loads.every(load => typeof load?.id === 'string')
}

// One spawn, note or key row per line, so the building session can read the file in pieces.
function serialize(r: Results): string {
  const list = (items: object[]) => (items.length === 0 ? '[]' : `[\n${items.map(item => JSON.stringify(item)).join(',\n')}\n]`)
  const loads = r.loads.map(load => {
    const { spawns, notes, keys, clientKeys, ...head } = load

    return (
      `${JSON.stringify(head).slice(0, -1)},\n"spawns":${list(spawns)},\n"notes":${list(notes)},\n` +
      `"keys":${list(keys)},\n"clientKeys":${list(clientKeys)}}`
    )
  })

  return `{"v":1,"system":${JSON.stringify(r.system)},"loads":[\n${loads.join(',\n')}\n]}\n`
}

function note(s: State, t: number, kind: string, text: string): void {
  s.load?.notes.push({ at: t, kind, text })
  s.dirty = true
  s.changed = true
}

/** The mod's own folder: this prototype sits two levels below it. */
function modPath(root: string, ...rel: string[]): string {
  const trimmed = root.replace(/[\\/]+$/, '')
  const sep = trimmed.includes('\\') ? '\\' : '/'

  return [...trimmed.split(/[\\/]/).slice(0, -2), ...rel].join(sep)
}

// PLAN.md 6.12: Windows by OS, then WSL by its distribution variable, then uname.
async function pickSystem($: EngineInterface): Promise<System> {
  if ((await $.env.get('OS')) === 'Windows_NT') return 'windows'
  const distro = await $.env.get('WSL_DISTRO_NAME')
  if (distro !== undefined && distro !== '') return 'wsl'
  try {
    const { stdout } = await $.process.run(['uname', '-s'], { timeoutMs: 5000 })

    return /darwin/i.test(stdout) ? 'macos' : 'linux'
  } catch {
    return 'linux'
  }
}

// Only the Windows route is measured in M2; WSL, Linux and macOS follow in M2b.
async function helperArgv($: EngineInterface, system: System): Promise<{ argv: string[]; script: string }> {
  const root = $.plugin.root
  if (system === 'windows' || system === 'wsl') {
    const script = modPath(root, 'helper', 'keys.ps1')
    const path = system === 'wsl' ? (await $.process.run(['wslpath', '-w', script], { timeoutMs: 5000 })).stdout.trim() : script

    return { script, argv: [...PS, '-ExecutionPolicy', 'Bypass', '-File', path] }
  }
  if (system === 'linux') {
    const script = modPath(root, 'helper', 'keys.py')

    return { script, argv: ['python3', script] }
  }
  const script = modPath(root, 'helper', 'keys.js')

  return { script, argv: ['osascript', '-l', 'JavaScript', script] }
}

function onLine(s: State, spawn: Spawn, line: HelperLine, t: number): void {
  const load = s.load
  if (load === undefined) return
  if (line.kind === 'H') {
    spawn.heartbeats += 1
    spawn.firstHeartbeatAt ??= t
    s.lastHeartbeat = t
    if (!s.keys.ok) {
      s.keys = { ...s.keys, ok: true }
      s.changed = true
    }
  } else if (line.kind === 'K') {
    const seq = s.keys.seq + 1
    const first = !load.keys.some(row => row.spawn === spawn.n)
    s.keys = { ok: true, seq, mask: line.mask, at: line.at }
    if (load.keys.length < KEEP) {
      const row: KeyRow = { seq, spawn: spawn.n, first, mask: line.mask, helperAt: line.at, hooksAt: t, clientAt: null, working: s.working }
      load.keys.push(row)
      s.rows.set(seq, row)
    } else {
      load.keysDropped += 1
    }
    s.changed = true
  } else if (line.kind === 'E') {
    spawn.error = `E ${line.word}`
    s.keys = { ...s.keys, ok: false }
    s.changed = true
  } else if (spawn.other.length < 20) {
    spawn.other.push(line.text)
  }
}

// Started from a timer, never awaited by a hook: the loop runs for as long as the helper does.
async function startHelper($: EngineInterface, s: State): Promise<void> {
  const load = s.load
  if (load === undefined) return
  const spawn: Spawn = {
    n: load.spawns.length + 1,
    at: Date.now(),
    argv: [],
    firstChunkAt: null,
    firstHeartbeatAt: null,
    heartbeats: 0,
    other: [],
    stderr: '',
    error: null,
    stopAt: null,
    stopReason: null,
    endAt: null,
    exitCode: null,
    exitSignal: null,
  }
  load.spawns.push(spawn)
  s.spawn = spawn
  s.stopping = null
  s.live = true
  s.lastHeartbeat = 0
  s.changed = true
  s.dirty = true
  try {
    const { argv, script } = await helperArgv($, load.system)
    spawn.argv = argv
    if (!(await $.fs.exists(script))) {
      spawn.error = `no helper for ${load.system} yet: ${script}`

      return
    }
    const reader = new LineReader()
    spawn.at = Date.now()
    const stream = $.process.spawn({ argv })
    // Leaving the loop early rejects the result; nobody waits on it then.
    stream.result.catch(() => {})
    for await (const chunk of stream) {
      const t = Date.now()
      spawn.firstChunkAt ??= t
      if (chunk.stream === 'stderr') {
        if (spawn.stderr.length < 4000) spawn.stderr += chunk.text
      } else {
        for (const line of reader.push(chunk.text)) onLine(s, spawn, parseLine(line), t)
      }
      s.dirty = true
      // Leaving the loop kills the helper; a heartbeat comes at least every 500 ms.
      if (s.stopping !== null) break
    }
    if (s.stopping === null) {
      const end = await stream.result
      spawn.exitCode = end.code
      spawn.exitSignal = end.signal
    }
  } catch (err) {
    spawn.error = String(err)
  } finally {
    spawn.endAt = Date.now()
    s.live = false
    s.keys = { ...s.keys, ok: false }
    s.changed = true
    s.dirty = true
  }
}

function launch($: EngineInterface, s: State): void {
  const before = s.running
  s.running = before.then(() => startHelper($, s))
}

function stopHelper(s: State, reason: string): void {
  if (!s.live || s.stopping !== null || s.spawn === undefined) return
  s.stopping = reason
  s.spawn.stopAt = Date.now()
  s.spawn.stopReason = reason
  s.changed = true
  s.dirty = true
}

async function listHelpers($: EngineInterface, s: State): Promise<string> {
  const system = s.load?.system ?? 'windows'
  const argv = system === 'windows' || system === 'wsl' ? [...PS, '-Command', LIST_HELPERS] : ['pgrep', '-fl', 'helper/keys[.]']
  const t = Date.now()
  const own = s.live ? (/start pid (\d+)/.exec(s.spawn?.stderr ?? '')?.[1] ?? 'unknown') : 'none'
  try {
    const run = await $.process.run(argv, { timeoutMs: 20000 })
    const found = run.stdout
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line !== '')
    const text = `helpers running: ${found.length === 0 ? 'none' : found.join(', ')} (this load's own: ${own})`
    note(s, t, 'procs', text)

    return text
  } catch (err) {
    note(s, t, 'procs.failed', String(err))

    return `the process list failed: ${String(err)}`
  }
}

async function save($: EngineInterface, s: State): Promise<void> {
  const load = s.load
  if (s.saving || !s.used || load === undefined || s.path === '') return
  s.saving = true
  s.dirty = false
  try {
    // Other loads' entries are kept as they are. A file that does not parse is left alone.
    let others: Load[] = []
    if (await $.fs.exists(s.path)) {
      const old: unknown = JSON.parse(await $.fs.read(s.path))
      if (!isResults(old)) throw new Error('the file holds something else')
      others = old.loads.filter(other => other.id !== load.id)
    }
    load.savedAt = Date.now()
    const loads = [...others, load].sort((a, b) => a.loadedAt - b.loadedAt)
    await $.fs.write(s.path, serialize({ v: 1, system: load.system, loads }))
    s.saved = `saved (${load.keys.length} key changes)`
  } catch (err) {
    s.dirty = true
    s.saved = `not saved: ${String(err)}`
  } finally {
    s.saving = false
    s.changed = true
  }
}

function statusLines(s: State, t: number): string[] {
  const load = s.load
  if (load === undefined) return ['P4 key helper: loading']
  const spawn = s.spawn
  let helper = 'not started (/p4 on)'
  if (spawn !== undefined) {
    if (spawn.endAt !== null) helper = `ended (${spawn.error ?? spawn.stopReason ?? `exit ${spawn.exitCode ?? spawn.exitSignal}`})`
    else if (s.stopping !== null) helper = `stopping (${s.stopping})`
    else if (spawn.firstHeartbeatAt === null) helper = 'starting'
    else helper = s.keys.ok ? `running, last heartbeat ${t - s.lastHeartbeat} ms ago` : 'silent for 2 s'
  }
  const beats = load.spawns.flatMap(sp => (sp.firstHeartbeatAt === null ? [] : [sp.firstHeartbeatAt - sp.at]))
  const rows = load.keys.filter(row => !row.first)
  const toHooks = rows.map(row => row.hooksAt - row.helperAt)
  const toClient = rows.flatMap(row => (row.clientAt === null ? [] : [row.clientAt - row.helperAt]))

  return [
    `P4 key helper   ${load.system}   helper: ${helper}   spawns ${load.spawns.length}   load ${load.id}`,
    `spawn to first heartbeat: ${beats.length === 0 ? 'none yet' : `${beats.slice(-6).join(', ')} ms`}`,
    `key to hooks module: ${describe(toHooks)}`,
    `key to Client: ${describe(toClient)}, ${rows.length - toClient.length} overtaken by a later mask`,
    `key changes ${rows.length}${load.keysDropped > 0 ? ` (and ${load.keysDropped} not kept)` : ''}, ` +
      `onKey presses ${load.clientKeys.length}, results ${s.used ? s.saved : 'not written (nothing started yet)'}`,
  ]
}

function refresh(s: State, t: number): void {
  if (s.live && s.keys.ok && s.lastHeartbeat > 0 && t - s.lastHeartbeat > 2000) {
    s.keys = { ...s.keys, ok: false }
    note(s, t, 'heartbeat.missing', `${t - s.lastHeartbeat} ms since the last one`)
  }
  if (s.changed || s.live) {
    s.lines = statusLines(s, t)
    s.changed = false
  }
}

export const register: Register = on => {
  const s: State = {
    load: undefined,
    path: '',
    used: false,
    dirty: false,
    saving: false,
    saved: 'not saved yet',
    shown: false,
    working: false,
    running: Promise.resolve(),
    live: false,
    stopping: null,
    spawn: undefined,
    keys: { ok: false, seq: 0, mask: 0, at: 0 },
    lastHeartbeat: 0,
    rows: new Map(),
    instance: '',
    acks: new Map(),
    lines: ['P4 key helper: loading'],
    changed: true,
  }

  const props = (): P4Props => ({ v: 1, instance: s.instance, ack: s.acks.get(s.instance) ?? 0, keys: s.keys, lines: s.lines })

  on('session.start', async ($, e, next) => {
    const t = Date.now()
    const system = await pickSystem($)
    const { version } = await $.session.version()
    s.load = {
      id: Math.random().toString(36).slice(2, 10),
      session: await $.session.id(),
      build: version,
      system,
      loadedAt: t,
      savedAt: 0,
      endedAt: null,
      keysDropped: 0,
      spawns: [],
      notes: [],
      keys: [],
      clientKeys: [],
    }
    s.path = `${$.plugin.root}/../results/p4-key-helper-${system}.json`
    s.lines = statusLines(s, t)

    await $.command.register({
      name: 'p4',
      description: 'P4 key helper: status, or on [note], off, restart, procs, mark <text>, save',
      argumentHint: '[on|off|restart|procs|mark <text>|save]',
      immediate: true,
    })
    $.clock.every(250, () => refresh(s, Date.now()))
    $.clock.every(2000, () => {
      if (s.dirty) void save($, s)
    })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    stopHelper(s, 'session.end')
    if (s.load !== undefined) s.load.endedAt = Date.now()
    await save($, s)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const p = e.props
    s.working = p.isWorking
    if (e.surface !== 'terminal' || !s.shown || p.hasSurvey) return next(e)

    const { Box, Client } = $.ui.resolve(e)

    return (
      <Box>
        <Client key="p4" module="./court.tsx" props={props()} width={Math.min(160, p.bodyColumns)} height={Math.min(ROWS, p.maxRows)} />
      </Box>
    )
  })

  // Every tick's post is answered with the current key state: that is the path PLAN.md 6.9 plans.
  on('ui.message', async ($, e) => {
    if (!isPost(e.data)) return {}
    const post = e.data
    if (post.instance !== s.instance) {
      if (s.load !== undefined) note(s, Date.now(), 'instance', post.instance)
      s.instance = post.instance
    }
    let ack = s.acks.get(post.instance) ?? 0
    for (const event of post.events) {
      if (event.n <= ack) continue
      ack = event.n
      if (event.kind === 'mask') {
        const row = s.rows.get(event.seq)
        if (row !== undefined && row.clientAt === null) row.clientAt = event.at
      } else if (s.load !== undefined && s.load.clientKeys.length < KEEP) {
        s.load.clientKeys.push({ at: event.at, key: event.key, instance: post.instance })
      }
      s.dirty = true
      s.changed = true
    }
    s.acks.set(post.instance, ack)

    return { props: props() }
  })

  on('ui.fault', async ($, e, next) => {
    note(s, Date.now(), 'ui.fault', `${e.phase}: ${String(e.reason)}`)

    return next(e)
  })

  on('command.run', { command: 'p4' }, async ($, e) => {
    const t = Date.now()
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const text = rest.join(' ')

    if (verb === 'on') {
      s.used = true
      note(s, t, 'on', text)
      s.shown = true
      $.ui.invalidate('ui.render')
      const start = !s.live || s.stopping !== null
      if (start) $.clock.after(0, () => launch($, s))

      return { text: `P4: court shown, ${start ? 'helper starting' : 'the helper already runs'}.` }
    }
    if (verb === 'off') {
      note(s, t, 'off', text)
      stopHelper(s, 'off')
      s.shown = false
      $.ui.invalidate('ui.render')

      return { text: 'P4: helper stopping, court hidden.' }
    }
    if (verb === 'restart') {
      s.used = true
      note(s, t, 'restart', text)
      stopHelper(s, 'restart')
      $.clock.after(0, () => launch($, s))

      return { text: 'P4: helper restarting.' }
    }
    if (verb === 'procs') {
      s.used = true

      return { text: `P4: ${await listHelpers($, s)}.` }
    }
    if (verb === 'mark') {
      s.used = true
      note(s, t, 'mark', text)

      return { text: `P4: marked "${text}".` }
    }
    if (verb === 'save') {
      s.used = true
      await save($, s)

      return { text: `P4: ${s.saved}.` }
    }

    return { text: statusLines(s, t).join('\n') }
  })
}
