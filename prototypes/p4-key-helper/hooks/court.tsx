import type { ClientKeyEvent, ClientModule, ClientSurface } from 'claude-code'

import { ESC, FRONT, JUMP, LEFT, RIGHT } from './protocol'
import type { ClientEvent, P4Post, P4Props } from './protocol'

// P4 key helper, drawing thread: shows the helper's key mask as the props bring it, runs a marker
// by it, and posts on every tick, so the hooks module can answer each post with fresh key state
// (PLAN.md 6.8). It reports when each new mask arrived here, and every onKey press.

const STEPS = [
  'Steps: 1 click into this box   2 tap A, D, W once each   3 hold A 2 s, then D 2 s',
  '4 hold A and W together, let go of W, then of A   5 tap keys fast for 20 s (about 200 key changes in all)',
  '6 Alt+Tab to another window, press A and D there, come back   7 Esc once (the keyboard goes back to the prompt)',
  '8 ask Claude for a long answer, click here and tap keys while it streams   9 Esc, then /p4 restart three times, a few s apart',
  '10 /p4 off, then /p4 procs   11 /p4 on, tell the building session "reload", then /p4 procs   12 /p4 on, then quit Claude',
]

const BLUE = '#4aa3ff'
const ORANGE = '#d97757'
const GREEN = '#5f9a6a'

type Probe = {
  instance: string
  n: number
  outbox: ClientEvent[]
  props: P4Props
  /** The last key state seen here. */
  seq: number
  lastDelay: number
  keys: string[]
  downs: number
  x: number
  lift: number
  last: number
  frame: number
}

type Held = { probe: Probe; frame: number }

function push(p: Probe, event: ClientEvent): void {
  p.outbox.push(event)
  if (p.outbox.length > 600) p.outbox.shift()
}

function tick(p: Probe, surface: ClientSurface<Held>): void {
  const t = performance.now()
  const dt = Math.min(0.1, (t - p.last) / 1000)
  p.last = t

  // The marker runs at the game's run speed (PLAN.md 6.3) and lifts while jump is held.
  const keys = p.props.keys
  const mask = keys.ok ? keys.mask : 0
  const width = Math.max(4, surface.columns)
  const run = ((mask & RIGHT) !== 0 ? 1 : 0) - ((mask & LEFT) !== 0 ? 1 : 0)
  p.x = Math.max(0, Math.min(width - 2, p.x + (run * width * dt) / 2 / 1.3))
  p.lift = (mask & JUMP) !== 0 ? Math.min(2, p.lift + 10 * dt) : Math.max(0, p.lift - 10 * dt)

  p.frame += 1
  const post: P4Post = { v: 1, instance: p.instance, events: p.outbox.slice(0, 200) }
  surface.post(post)
  surface.setState({ probe: p, frame: p.frame })
}

function key(p: Probe, e: ClientKeyEvent): void {
  p.n += 1
  push(p, { n: p.n, kind: 'key', key: e.key, at: Date.now() })
  p.keys.push(e.key)
  if (p.keys.length > 10) p.keys.shift()
}

function begin(surface: ClientSurface<Held>, props: P4Props): Probe {
  const p: Probe = {
    instance: crypto.randomUUID().slice(0, 8),
    n: 0,
    outbox: [],
    props,
    // The key state at mount is old news: only later ones are timed.
    seq: props.keys.seq,
    lastDelay: -1,
    keys: [],
    downs: 0,
    x: Math.max(0, surface.columns / 2 - 1),
    lift: 0,
    last: performance.now(),
    frame: 0,
  }
  surface.every(16, () => tick(p, surface))
  surface.onPointer(e => {
    if (e.type === 'down') p.downs += 1
  })
  surface.onKey(e => key(p, e))
  surface.setState({ probe: p, frame: 0 })

  return p
}

const P4Court: ClientModule<P4Props, Held> = (props, surface) => {
  const p = surface.state?.probe ?? begin(surface, props)
  p.props = props

  // Props drawn before this instance's first post still carry the previous instance's numbers.
  if (props.instance === p.instance && props.ack > 0) p.outbox = p.outbox.filter(e => e.n > props.ack)
  if (props.keys.seq !== p.seq) {
    const t = Date.now()
    p.n += 1
    push(p, { n: p.n, kind: 'mask', seq: props.keys.seq, at: t })
    p.lastDelay = t - props.keys.at
    p.seq = props.keys.seq
  }

  const { Box, Text } = surface.elements
  const width = Math.max(4, surface.columns)
  const mask = props.keys.ok ? props.keys.mask : 0
  const lamp = (label: string, bit: number, color: string) =>
    (mask & bit) !== 0 ? (
      <Text color="#000000" backgroundColor={color}>{` ${label} `}</Text>
    ) : (
      <Text dimColor>{` ${label} `}</Text>
    )
  const level = Math.round(p.lift)
  const runner = [2, 1, 0].map(row =>
    row === level ? (
      <Text wrap="truncate">
        {' '.repeat(Math.round(p.x))}
        <Text color={BLUE}>██</Text>
      </Text>
    ) : (
      <Text> </Text>
    ),
  )

  return (
    <Box flexDirection="column">
      {props.lines.map(line => (
        <Text wrap="truncate">{line}</Text>
      ))}
      <Text wrap="truncate">
        {lamp('LEFT', LEFT, BLUE)} {lamp('RIGHT', RIGHT, BLUE)} {lamp('JUMP', JUMP, BLUE)} {lamp('ESC', ESC, ORANGE)}{' '}
        {lamp('TERMINAL IN FRONT', FRONT, GREEN)}
        {`   last mask here ${p.lastDelay < 0 ? '-' : `${p.lastDelay} ms`} after the key, helper ${props.keys.ok ? 'ok' : 'silent'}, ` +
          `clicks ${p.downs}, onKey: ${p.keys.join(' ')}`}
      </Text>
      {runner}
      <Text dimColor wrap="truncate">
        {'─'.repeat(width)}
      </Text>
      {STEPS.map(line => (
        <Text wrap="truncate" dimColor>
          {line}
        </Text>
      ))}
    </Box>
  )
}

export default P4Court
