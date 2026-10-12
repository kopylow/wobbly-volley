import type { ClientKeyEvent, ClientModule, ClientPointerEvent, ClientSurface } from 'claude-code'

import type { Field, ProbeEvent, ProbePost, ProbeProps } from './protocol'

// P1 band probe, drawing thread: counts ticks, renders and both clocks, logs every pointer and key
// event, and posts it all to register.tsx, which writes prototypes/results/p1-band.json.

type Window = {
  startPerf: number
  startDate: number
  ticks: number
  renders: number
  minGap: number
  maxGap: number
  moves: number
  bareMoves: number
  firstMove: string
  lastMove: string
}

type Closed = { ticks: number; perfMs: number; dateMs: number; minGap: number; maxGap: number; renders: number; rtt: string }

type Probe = {
  instance: string
  mount: number
  seq: number
  n: number
  outbox: ProbeEvent[]
  dropped: number
  lastTickPerf: number
  window: Window
  closed: Closed | undefined
  sentAt: Map<number, number>
  lastEcho: number
  rtts: number[]
  moves: number
  bareMoves: number
  downs: number
  ups: number
  lastPointer: string
  lastInput: string
  keys: string[]
  keyCount: number
  columns: number
  rows: number
}

type Held = { probe: Probe; frame: number }

const STEPS = [
  'Steps: 1 leave it 15 s   2 hover over this box, no click   3 click here, type asdf, arrows, Space, hold Right 2 s',
  '4 Esc once, then type xyz   5 click here, press h, type qwe while it is gone, press k once it is back',
  '6 click [-], wait 5 s, open it again   7 window narrower, then only shorter, then restore it',
  '8 type /p1 ask, click here within 5 s, in the dialog press an arrow and a letter, then answer',
  '9 ask Claude for a long answer: click here, Esc, wait 3 s, Esc   10 ask Claude to ask you something, click here',
]

// Counts instances across the module's life: a remount in the same environment shows as mount 2.
let mounts = 0

const round = (ms: number) => Math.round(ms * 10) / 10

// Either clock may be missing or frozen on the drawing thread: that is one of the questions.
function perfNow(): number {
  try {
    return typeof performance === 'object' && typeof performance.now === 'function' ? performance.now() : -1
  } catch {
    return -2
  }
}

function dateNow(): number {
  try {
    return typeof Date === 'function' && typeof Date.now === 'function' ? Date.now() : -1
  } catch {
    return -2
  }
}

function freshWindow(perf: number, date: number): Window {
  return {
    startPerf: perf,
    startDate: date,
    ticks: 0,
    renders: 0,
    minGap: Infinity,
    maxGap: 0,
    moves: 0,
    bareMoves: 0,
    firstMove: '',
    lastMove: '',
  }
}

function record(p: Probe, kind: string, fields: Record<string, Field> = {}): void {
  p.n += 1
  p.outbox.push({ n: p.n, perf: round(perfNow()), date: dateNow(), kind, ...fields })
  if (p.outbox.length > 600) {
    p.outbox.shift()
    p.dropped += 1
  }
}

function percentile(sorted: number[], q: number): number {
  return sorted.length === 0 ? -1 : (sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? -1)
}

function closeWindow(p: Probe, perf: number, date: number): void {
  const w = p.window
  const sorted = [...p.rtts].sort((a, b) => a - b)
  const rttMed = round(percentile(sorted, 0.5))
  const rttP95 = round(percentile(sorted, 0.95))
  const closed: Closed = {
    ticks: w.ticks,
    perfMs: round(perf - w.startPerf),
    dateMs: date - w.startDate,
    minGap: w.minGap === Infinity ? -1 : round(w.minGap),
    maxGap: round(w.maxGap),
    renders: w.renders,
    rtt: `median ${rttMed} ms, 95th ${rttP95} ms over ${sorted.length}`,
  }
  record(p, 'window', {
    ticks: closed.ticks,
    perfMs: closed.perfMs,
    dateMs: closed.dateMs,
    minGap: closed.minGap,
    maxGap: closed.maxGap,
    renders: closed.renders,
    moves: w.moves,
    bareMoves: w.bareMoves,
    firstMove: w.firstMove,
    lastMove: w.lastMove,
    rttMed,
    rttP95,
    rttN: sorted.length,
    columns: p.columns,
    rows: p.rows,
  })
  p.closed = closed
  p.rtts = []
  p.window = freshWindow(perf, date)
}

function redraw(p: Probe, surface: ClientSurface<Held>): void {
  surface.setState({ probe: p, frame: p.seq })
}

function tick(p: Probe, surface: ClientSurface<Held>): void {
  const perf = perfNow()
  const date = dateNow()
  const w = p.window
  if (p.lastTickPerf >= 0) {
    const gap = perf - p.lastTickPerf
    w.minGap = Math.min(w.minGap, gap)
    w.maxGap = Math.max(w.maxGap, gap)
  }
  p.lastTickPerf = perf
  w.ticks += 1

  // A frozen performance.now() would never close a window: then 62 ticks count as one.
  if (perf - w.startPerf >= 1000 || (w.ticks >= 62 && perf === w.startPerf)) {
    closeWindow(p, perf, date)
  }

  p.seq += 1
  p.sentAt.set(p.seq, perf)
  if (p.sentAt.size > 240) {
    const oldest = p.sentAt.keys().next()
    if (!oldest.done) p.sentAt.delete(oldest.value)
  }
  const data: ProbePost = { v: 1, instance: p.instance, seq: p.seq, events: p.outbox.slice(0, 200) }
  surface.post(data)
  redraw(p, surface)
}

function pointer(p: Probe, e: ClientPointerEvent, surface: ClientSurface<Held>): void {
  const where = `${e.x},${e.y}`
  const button = e.button ?? null
  if (e.type === 'move') {
    const w = p.window
    w.moves += 1
    p.moves += 1
    if (button === null) {
      w.bareMoves += 1
      p.bareMoves += 1
    }
    if (w.firstMove === '') w.firstMove = where
    w.lastMove = where
    // Moves are counted per window; only the first one after any other input is logged singly.
    if (p.lastInput !== 'move') record(p, 'move', { x: e.x, y: e.y, button, fine: e.fine !== undefined })
  } else {
    if (e.type === 'down') p.downs += 1
    if (e.type === 'up') p.ups += 1
    record(p, e.type, {
      x: e.x,
      y: e.y,
      button,
      fine: e.fine !== undefined,
      shift: e.shift ?? false,
      alt: e.alt ?? false,
      ctrl: e.ctrl ?? false,
    })
  }
  p.lastPointer = `${e.type} ${where}${button === null ? '' : ` ${button}`}`
  p.lastInput = e.type
  redraw(p, surface)
}

function key(p: Probe, e: ClientKeyEvent, surface: ClientSurface<Held>): void {
  record(p, 'key', { key: e.key, ctrl: e.ctrl ?? false, shift: e.shift ?? false, meta: e.meta ?? false })
  p.keyCount += 1
  p.keys.push(JSON.stringify(e.key))
  if (p.keys.length > 12) p.keys.shift()
  p.lastInput = 'key'
  if (e.key === 'h' && e.ctrl !== true && e.meta !== true) record(p, 'hideRequest', { ms: 5000 })
  redraw(p, surface)
}

function begin(surface: ClientSurface<Held>): Probe {
  mounts += 1
  const perf = perfNow()
  const date = dateNow()
  const p: Probe = {
    instance: crypto.randomUUID().slice(0, 8),
    mount: mounts,
    seq: 0,
    n: 0,
    outbox: [],
    dropped: 0,
    lastTickPerf: -1,
    window: freshWindow(perf, date),
    closed: undefined,
    sentAt: new Map(),
    lastEcho: 0,
    rtts: [],
    moves: 0,
    bareMoves: 0,
    downs: 0,
    ups: 0,
    lastPointer: 'none',
    lastInput: 'none',
    keys: [],
    keyCount: 0,
    columns: surface.columns,
    rows: surface.rows,
  }
  record(p, 'mount', {
    mount: mounts,
    perfType: typeof performance === 'object' ? typeof performance.now : typeof performance,
    dateType: typeof Date === 'function' ? typeof Date.now : typeof Date,
    perf,
    date,
    columns: surface.columns,
    rows: surface.rows,
  })
  surface.every(16, () => tick(p, surface))
  surface.onPointer(e => pointer(p, e, surface))
  surface.onKey(e => key(p, e, surface))
  surface.setState({ probe: p, frame: 0 })

  return p
}

const P1Probe: ClientModule<ProbeProps, Held> = (props, surface) => {
  const p = surface.state?.probe ?? begin(surface)
  p.window.renders += 1

  // Props drawn before this instance's first post still carry the previous instance's numbers.
  const mine = props.instance === p.instance
  if (mine && props.ack > 0) p.outbox = p.outbox.filter(e => e.n > props.ack)
  if (mine && props.echo !== p.lastEcho) {
    const sent = p.sentAt.get(props.echo)
    if (sent !== undefined) p.rtts.push(perfNow() - sent)
    p.lastEcho = props.echo
  }
  if (surface.columns !== p.columns || surface.rows !== p.rows) {
    record(p, 'region', { columns: surface.columns, rows: surface.rows, wasColumns: p.columns, wasRows: p.rows })
    p.columns = surface.columns
    p.rows = surface.rows
  }

  const c = p.closed
  const lines = [
    `P1 band probe   instance ${p.instance} (mount ${p.mount})   region ${surface.columns}x${surface.rows}   ` +
      `posts ${p.seq}, unacknowledged ${p.outbox.length}${p.dropped > 0 ? `, dropped ${p.dropped}` : ''}`,
    c === undefined
      ? 'ticks: first window still running'
      : `ticks ${c.ticks} in ${c.perfMs} ms (gaps ${c.minGap} to ${c.maxGap} ms), renders ${c.renders}   ` +
        `clocks over it: performance.now +${c.perfMs} ms, Date.now +${c.dateMs} ms`,
    `post to props round trip: ${c?.rtt ?? 'first window still running'}`,
    `pointer: ${p.moves} moves (${p.bareMoves} without a button), ${p.downs} downs, ${p.ups} ups, last ${p.lastPointer}`,
    `keys: ${p.keyCount}, last ${p.keys.join(' ')}`,
    ...props.lines,
    '',
    ...STEPS,
  ]

  const { Box, Text } = surface.elements

  return (
    <Box flexDirection="column">
      {lines.map(line => (
        <Text wrap="truncate">{line}</Text>
      ))}
    </Box>
  )
}

export default P1Probe
