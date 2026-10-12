import type { Register } from 'claude-code'

import type { Field, ProbePost, ProbeProps } from './protocol'

// P1 band probe, hooks worker: draws probe.tsx in the band, logs what the engine and the Client
// report, and keeps prototypes/results/p1-band.json up to date (PLAN.md section 7).

type LogEvent = { t: number; src: 'hooks' | 'client'; kind: string; [field: string]: Field }

type Results = {
  v: 1
  build: string
  updatedAt: number
  loads: { at: number; build: string }[]
  events: LogEvent[]
  windows: LogEvent[]
}

// The per-second lines (`window`, `posts`) keep a list of their own, so they never push the
// person's steps out of the log: about 10 minutes of them, and 6000 other events.
const KEEP = 6000
const KEEP_WINDOWS = 1200
const HIDE_MS = 5000

const isPeriodic = (kind: string) => kind === 'window' || kind === 'posts'

function dateNow(): number {
  try {
    return typeof Date === 'function' && typeof Date.now === 'function' ? Date.now() : -1
  } catch {
    return -2
  }
}

function isPost(data: unknown): data is ProbePost {
  if (typeof data !== 'object' || data === null) return false
  const post = data as Partial<ProbePost>

  return post.v === 1 && typeof post.instance === 'string' && typeof post.seq === 'number' && Array.isArray(post.events)
}

function isResults(data: unknown): data is Results {
  if (typeof data !== 'object' || data === null) return false
  const old = data as Partial<Results>

  return old.v === 1 && Array.isArray(old.events) && Array.isArray(old.loads)
}

// One event per line, so the building session can read the file in pieces.
function serialize(results: Results): string {
  const head = { v: results.v, build: results.build, updatedAt: results.updatedAt, loads: results.loads }
  const lines = (list: LogEvent[]) => list.map(e => JSON.stringify(e)).join(',\n')

  return `${JSON.stringify(head).slice(0, -1)},"events":[\n${lines(results.events)}\n],"windows":[\n${lines(results.windows)}\n]}\n`
}

export const register: Register = on => {
  let results: Results = { v: 1, build: 'unknown', updatedAt: 0, loads: [], events: [], windows: [] }
  let write: ((text: string) => Promise<void>) | undefined
  let now: (() => Promise<number>) | undefined
  let dirty = false
  let saving = false
  let saved = 'not saved yet'

  let instance = ''
  const acks = new Map<string, number>()
  let echo = 0
  let hidden = false

  let band = 'band: not asked yet'
  let bandCalls = 0
  let bandSecond = 0
  let bandInSecond = 0
  let edits = 0
  let editsSinceDown = 0
  let lastEditKey = ''
  let turn = 'none yet'
  let dialog = 'none'
  let focusEvents = 0
  let faults = 0
  let postWindowStart = 0
  let postWindowDate = 0
  let postsInWindow = 0
  let postsPerSecond = 'first window still running'

  const add = (event: LogEvent) => {
    const [list, max] = isPeriodic(event.kind) ? [results.windows, KEEP_WINDOWS] : [results.events, KEEP]
    list.push(event)
    if (list.length > max) list.splice(0, list.length - max)
    dirty = true
  }

  const log = (t: number, kind: string, fields: Record<string, Field> = {}) => add({ t, src: 'hooks', kind, ...fields })

  const save = async () => {
    if (saving || write === undefined || now === undefined) return
    saving = true
    dirty = false
    try {
      results.updatedAt = await now()
      await write(serialize(results))
      saved = `saved ${results.events.length} events, ${results.windows.length} windows`
    } catch (err) {
      saved = `save failed: ${String(err)}`
      dirty = true
    } finally {
      saving = false
    }
  }

  const props = (): ProbeProps => ({
    v: 1,
    instance,
    ack: acks.get(instance) ?? 0,
    echo,
    lines: [
      band,
      `prompt.edit: ${edits} in all, ${editsSinceDown} since the last click in the box` +
        (lastEditKey === '' ? '' : `, last key ${lastEditKey}`),
      `turn: ${turn}   dialog: ${dialog}   ui.focus events ${focusEvents}   ui.fault ${faults}`,
      `posts reaching the hooks module: ${postsPerSecond}`,
      `results: ${saved} to prototypes/results/p1-band.json`,
    ],
  })

  on('session.start', async ($, e, next) => {
    const path = `${$.plugin.root}/../results/p1-band.json`
    write = text => $.fs.write(path, text)
    now = () => $.clock.now()

    const t = await $.clock.now()
    const { version } = await $.session.version()
    try {
      const old: unknown = JSON.parse(await $.fs.read(path))
      // A file from before the split holds the per-second lines among the events. Hooks that ran
      // while the file was being read have logged into `results` already: their events are kept.
      if (isResults(old)) {
        const early = [...results.events, ...results.windows]
        const all = [...old.events, ...(Array.isArray(old.windows) ? old.windows : []), ...early]
        results = { ...old, events: all.filter(e => !isPeriodic(e.kind)), windows: all.filter(e => isPeriodic(e.kind)) }
      }
    } catch {
      // No results yet: start a fresh file.
    }
    results.build = version
    results.loads.push({ at: t, build: version })
    log(t, 'session.start', { build: version, hooksDate: dateNow() })

    await $.command.register({
      name: 'p1',
      description: 'P1 band probe: status, or ask, save, clear, mark <text>',
      argumentHint: '[ask|save|clear|mark <text>]',
      immediate: true,
    })
    $.clock.every(2000, () => {
      if (dirty) void save()
    })

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    log(await $.clock.now(), 'session.end', { reason: e.reason })
    await save()

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const t = await $.clock.now()
    const p = e.props
    const view = e.viewport
    bandCalls += 1
    band =
      `band: bodyColumns ${p.bodyColumns}, maxRows ${p.maxRows} (bodyRows ${p.scroll.bodyRows}), viewport ` +
      (view === undefined ? 'unmeasured' : `${view.columns}x${view.rows}${view.isFullscreen === true ? ' fullscreen' : ''}`) +
      `, working ${p.isWorking}, calls ${bandCalls}`

    // At most ten band calls a second are logged singly; the count above has them all.
    const second = Math.floor(t / 1000)
    if (second !== bandSecond) {
      bandSecond = second
      bandInSecond = 0
    }
    bandInSecond += 1
    if (bandInSecond <= 10) {
      log(t, 'band', {
        surface: e.surface,
        call: bandCalls,
        bodyColumns: p.bodyColumns,
        maxRows: p.maxRows,
        bodyRows: p.scroll.bodyRows,
        offset: p.scroll.offset,
        viewColumns: view?.columns ?? null,
        viewRows: view?.rows ?? null,
        fullscreen: view?.isFullscreen ?? null,
        working: p.isWorking,
        survey: p.hasSurvey,
        agent: p.view.agentId ?? null,
        hidden,
      })
    }

    if (e.surface !== 'terminal' || hidden || p.hasSurvey) return next(e)

    const { Box, Client } = $.ui.resolve(e)

    return (
      <Box>
        <Client key="probe" module="./probe.tsx" props={props()} width={p.bodyColumns} height={Math.min(24, p.maxRows)} />
      </Box>
    )
  })

  on('ui.message', async ($, e) => {
    const t = await $.clock.now()
    if (!isPost(e.data)) {
      log(t, 'badPost')

      return {}
    }
    const post = e.data
    if (post.instance !== instance) {
      log(t, 'instance', { instance: post.instance, was: instance === '' ? null : instance })
      instance = post.instance
    }

    let ack = acks.get(post.instance) ?? 0
    for (const event of post.events) {
      if (event.n <= ack) continue
      ack = event.n
      add({ t, src: 'client', instance: post.instance, ...event })
      if (event.kind === 'down') editsSinceDown = 0
      if (event.kind === 'hideRequest' && !hidden) {
        hidden = true
        log(t, 'band.hide', { ms: HIDE_MS })
        $.ui.invalidate('ui.render')
        $.clock.after(HIDE_MS, () => {
          hidden = false
          void $.clock.now().then(shownAt => log(shownAt, 'band.show'))
          $.ui.invalidate('ui.render')
        })
      }
    }
    acks.set(post.instance, ack)
    echo = post.seq
    dirty = true

    // Posts a second by the hooks clock, with this environment's Date.now beside it.
    if (postWindowStart === 0) {
      postWindowStart = t
      postWindowDate = dateNow()
      postsInWindow = 0
    }
    postsInWindow += 1
    if (t - postWindowStart >= 1000) {
      log(t, 'posts', { n: postsInWindow, ms: t - postWindowStart, hooksDateMs: dateNow() - postWindowDate, instance })
      postsPerSecond = `${postsInWindow} in ${t - postWindowStart} ms`
      postWindowStart = 0
    }

    return { props: props() }
  })

  // The probe only watches: a failing hook here must never hold the focus or a dialog back.
  on('ui.focus', async ($, e, next) => {
    focusEvents += 1
    log(await $.clock.now(), 'ui.focus', { component: e.component, element: e.element ?? null, origin: e.origin.kind })

    return next(e)
  }).catch(($, e, next) => next(e))

  on('ui.fault', async ($, e, next) => {
    faults += 1
    log(await $.clock.now(), 'ui.fault', { phase: e.phase, reason: String(e.reason), element: e.element })

    return next(e)
  })

  on('prompt.edit', async ($, e, next) => {
    edits += 1
    editsSinceDown += 1
    lastEditKey = e.key === undefined ? '(paste or burst)' : JSON.stringify(e.key.key)
    log(await $.clock.now(), 'prompt.edit', { key: e.key?.key ?? null, before: e.text.length, start: e.start })

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    log(await $.clock.now(), 'turn.start', { turnId: e.turnId })
    turn = `running (${e.turnId.slice(0, 8)})`

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    log(await $.clock.now(), 'turn.complete', { reason: e.reason, agentId: e.agentId ?? null, durationMs: e.durationMs })
    if (e.agentId === undefined) turn = `last one ended: ${e.reason} after ${Math.round(e.durationMs / 1000)} s`

    return next(e)
  })

  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    log(await $.clock.now(), 'askTool.start')
    dialog = 'AskUserQuestion open'
    try {
      return await next(e)
    } finally {
      log(await $.clock.now(), 'askTool.settled')
      dialog = 'AskUserQuestion settled'
    }
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'p1' }, async ($, e) => {
    const t = await $.clock.now()
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    log(t, 'command', { args: e.args })

    if (verb === 'ask') {
      dialog = 'opens in 5 s'
      $.clock.after(5000, () => {
        void (async () => {
          log(await $.clock.now(), 'ask.open')
          dialog = '$.ui.ask open'
          try {
            const answer = await $.ui.ask('P1 probe: which key did you press last in this dialog?', ['An arrow', 'A letter'])
            log(await $.clock.now(), 'ask.answer', { answer })
            dialog = `answered: ${answer}`
          } catch (err) {
            log(await $.clock.now(), 'ask.rejected', { reason: String(err) })
            dialog = 'dismissed'
          }
        })()
      })

      return { text: 'P1: a dialog opens in 5 s. Click into the probe box now.' }
    }
    if (verb === 'save') {
      await save()

      return { text: `P1: ${saved}.` }
    }
    if (verb === 'clear') {
      results.events = []
      results.windows = []
      dirty = true

      return { text: 'P1: log cleared.' }
    }
    if (verb === 'mark') {
      log(t, 'mark', { text: rest.join(' ') })

      return { text: `P1: marked "${rest.join(' ')}".` }
    }

    return { text: `P1 band probe: ${results.events.length} events, instance ${instance || 'none yet'}, posts ${postsPerSecond}; ${saved}.` }
  })
}
