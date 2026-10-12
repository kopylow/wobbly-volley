import type { EngineInterface, Register } from 'claude-code'

import type { CourtProps, CourtReport, CourtWindow } from './protocol'

// P2 court, hooks worker: draws court.tsx in the band, keeps its reports, samples the CPU of the
// claude process through helper/cpu.ps1, and writes prototypes/results/p2-client-court.json
// (PLAN.md section 7).

type Field = string | number | boolean | null
type Entry = { t: number; kind: string; [field: string]: Field }
type Report = CourtWindow & { t: number; instance: string; shown: boolean }
type Cpu = {
  t: number
  percent: number
  cpuMs: number
  wallMs: number
  pid: number
  trigger: string
  shown: boolean
  workingAtStart: boolean
  workingAtEnd: boolean
  tickMs: number
  columns: number
}

type Results = {
  v: 1
  build: string
  updatedAt: number
  loads: { at: number; build: string }[]
  events: Entry[]
  reports: Report[]
  cpu: Cpu[]
}

/** Everything the hooks share; one object, so top-level functions can take it beside `$`. */
type State = {
  results: Results
  dirty: boolean
  shown: boolean
  tickMs: number
  working: boolean
  columns: number
  sampling: boolean
  cpuLine: string
}

const KEEP_REPORTS = 3600

function isReport(data: unknown): data is CourtReport {
  if (typeof data !== 'object' || data === null) return false
  const report = data as Partial<CourtReport>

  return report.v === 1 && typeof report.instance === 'string' && typeof report.window === 'object' && report.window !== null
}

function isResults(data: unknown): data is Results {
  if (typeof data !== 'object' || data === null) return false
  const old = data as Partial<Results>

  return old.v === 1 && Array.isArray(old.events) && Array.isArray(old.reports) && Array.isArray(old.cpu) && Array.isArray(old.loads)
}

// One entry per line, so the building session can read the file in pieces.
function serialize(r: Results): string {
  const head = { v: r.v, build: r.build, updatedAt: r.updatedAt, loads: r.loads }
  const list = (items: object[]) => items.map(item => JSON.stringify(item)).join(',\n')

  return (
    `${JSON.stringify(head).slice(0, -1)},"cpu":[\n${list(r.cpu)}\n],"events":[\n${list(r.events)}\n],` +
    `"reports":[\n${list(r.reports)}\n]}\n`
  )
}

function log(s: State, t: number, kind: string, fields: Record<string, Field> = {}): void {
  s.results.events.push({ t, kind, ...fields })
  s.dirty = true
}

// Started from a timer and never awaited by a hook: the run takes about 12 s.
async function sample($: EngineInterface, s: State, trigger: string): Promise<void> {
  if (s.sampling) return
  s.sampling = true
  const label = { trigger, shown: s.shown, workingAtStart: s.working, tickMs: s.tickMs, columns: s.columns }
  s.cpuLine = 'CPU: sampling for 10 s'
  $.ui.invalidate('ui.render')
  try {
    const script = `${$.plugin.root}\\helper\\cpu.ps1`
    const run = await $.process.run(
      ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script, '-Seconds', '10'],
      { timeoutMs: 30000 },
    )
    const t = await $.clock.now()
    const match = /^CPU (\d+) (\d+) (\d+)/m.exec(run.stdout)
    if (match === null) {
      log(s, t, 'cpu.failed', { exitCode: run.exitCode, stdout: run.stdout.slice(0, 300), stderr: run.stderr.slice(0, 300) })
      s.cpuLine = 'CPU: sample failed'
    } else {
      const cpuMs = Number(match[1])
      const wallMs = Number(match[2])
      const percent = Math.round((1000 * cpuMs) / wallMs) / 10
      s.results.cpu.push({ t, percent, cpuMs, wallMs, pid: Number(match[3]), ...label, workingAtEnd: s.working })
      s.dirty = true
      s.cpuLine =
        `CPU ${percent}% of a core (${trigger}, court ${label.shown ? 'shown' : 'hidden'}, ` +
        `${label.workingAtStart ? 'turn' : 'idle'}, tick ${label.tickMs} ms)`
    }
  } catch (err) {
    log(s, await $.clock.now(), 'cpu.failed', { reason: String(err) })
    s.cpuLine = 'CPU: sample failed'
  } finally {
    s.sampling = false
    $.ui.invalidate('ui.render')
  }
}

export const register: Register = on => {
  const s: State = {
    results: { v: 1, build: 'unknown', updatedAt: 0, loads: [], events: [], reports: [], cpu: [] },
    dirty: false,
    shown: true,
    tickMs: 16,
    working: false,
    columns: 0,
    sampling: false,
    cpuLine: 'CPU: no sample yet (/p2 cpu)',
  }
  let write: ((text: string) => Promise<void>) | undefined
  let clock: (() => Promise<number>) | undefined
  let saving = false

  const save = async () => {
    if (saving || write === undefined || clock === undefined) return
    saving = true
    s.dirty = false
    try {
      s.results.updatedAt = await clock()
      await write(serialize(s.results))
    } catch {
      s.dirty = true
    } finally {
      saving = false
    }
  }

  const props = (): CourtProps => ({ v: 1, tickMs: s.tickMs, working: s.working, cpu: s.cpuLine })

  on('session.start', async ($, e, next) => {
    const path = `${$.plugin.root}/../results/p2-client-court.json`
    write = text => $.fs.write(path, text)
    clock = () => $.clock.now()

    const t = await $.clock.now()
    const { version } = await $.session.version()
    try {
      const old: unknown = JSON.parse(await $.fs.read(path))
      // Hooks that ran while the file was being read have logged into `results` already.
      if (isResults(old)) {
        const early = s.results
        s.results = {
          ...old,
          events: [...old.events, ...early.events],
          reports: [...old.reports, ...early.reports],
          cpu: [...old.cpu, ...early.cpu],
        }
      }
    } catch {
      // No results yet: start a fresh file.
    }
    s.results.build = version
    s.results.loads.push({ at: t, build: version })
    log(s, t, 'session.start', { build: version })

    await $.command.register({
      name: 'p2',
      description: 'P2 court: status, or cpu, off, on, rate 16|33, save, mark <text>',
      argumentHint: '[cpu|off|on|rate <ms>|save|mark <text>]',
      immediate: true,
    })
    $.clock.every(2000, () => {
      if (s.dirty) void save()
    })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    log(s, await $.clock.now(), 'session.end', { reason: e.reason })
    await save()

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, ($, e, next) => {
    const p = e.props
    if (p.isWorking !== s.working) {
      s.working = p.isWorking
      void $.clock.now().then(t => log(s, t, 'working', { working: s.working }))
    }
    s.columns = Math.min(160, p.bodyColumns)
    if (e.surface !== 'terminal' || !s.shown || p.hasSurvey) return next(e)

    const { Box, Client } = $.ui.resolve(e)

    return (
      <Box>
        <Client key="court" module="./court.tsx" props={props()} width={s.columns} height={Math.min(25, p.maxRows)} />
      </Box>
    )
  })

  on('ui.message', async ($, e) => {
    const t = await $.clock.now()
    if (!isReport(e.data)) {
      log(s, t, 'badReport')

      return {}
    }
    const reports = s.results.reports
    reports.push({ t, instance: e.data.instance, shown: s.shown, ...e.data.window })
    if (reports.length > KEEP_REPORTS) reports.splice(0, reports.length - KEEP_REPORTS)
    s.dirty = true

    return {}
  })

  on('ui.fault', async ($, e, next) => {
    log(s, await $.clock.now(), 'ui.fault', { phase: e.phase, reason: String(e.reason) })

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    log(s, await $.clock.now(), 'turn.start', { turnId: e.turnId })
    // A sample of its own for every turn the court is shown in, once the turn is under way.
    if (s.shown) {
      $.clock.after(2000, () => {
        void sample($, s, 'turn')
      })
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    log(s, await $.clock.now(), 'turn.complete', { reason: e.reason, agentId: e.agentId ?? null, durationMs: e.durationMs })

    return next(e)
  })

  on('command.run', { command: 'p2' }, async ($, e) => {
    const t = await $.clock.now()
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    log(s, t, 'command', { args: e.args })

    if (verb === 'cpu') {
      if (s.sampling) return { text: 'P2: a CPU sample is already running.' }
      $.clock.after(0, () => {
        void sample($, s, 'command')
      })

      return { text: 'P2: sampling the CPU of this claude process for 10 s.' }
    }
    if (verb === 'off' || verb === 'on') {
      s.shown = verb === 'on'
      $.ui.invalidate('ui.render')

      return { text: `P2: court ${s.shown ? 'shown' : 'hidden'}.` }
    }
    if (verb === 'rate') {
      const ms = Number(rest[0])
      if (!Number.isInteger(ms) || ms < 8 || ms > 100) return { text: 'P2: rate takes a tick in ms, 8 to 100 (16 or 33).' }
      s.tickMs = ms
      $.ui.invalidate('ui.render')

      return { text: `P2: the court ticks every ${ms} ms.` }
    }
    if (verb === 'save') {
      await save()

      return { text: 'P2: saved.' }
    }
    if (verb === 'mark') {
      log(s, t, 'mark', { text: rest.join(' ') })

      return { text: `P2: marked "${rest.join(' ')}".` }
    }

    const recent = s.results.reports.slice(-10)
    const draws = recent.map(r => Math.round((r.renders * 1000) / Math.max(1, r.ms))).sort((a, b) => a - b)
    const median = draws[Math.floor(draws.length / 2)] ?? 0
    const gap = Math.max(0, ...recent.map(r => r.maxGap))

    return {
      text:
        `P2 court: last ${recent.length} s median ${median} draws a second, longest gap ${gap} ms, ` +
        `tick ${s.tickMs} ms, court ${s.shown ? 'shown' : 'hidden'}; ${s.cpuLine}.`,
    }
  })
}
