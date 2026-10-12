import type { ClientModule, ClientSurface, RenderNode } from 'claude-code'

import type { CourtProps, CourtReport, CourtWindow } from './protocol'

// P2 court, drawing thread: a throwaway scene (no game rules) painted in half blocks and encoded as
// PLAN.md 6.7 describes, redrawn on every tick. It measures what it draws and reports once a second.

// Palette of PLAN.md 3.2, plus the eyes. Sky is the terminal's own background.
const PALETTE = ['#3f6b4a', '#5f9a6a', '#d0d0d0', '#f2f2f2', '#4aa3ff', '#d97757', '#ffffff', '#202020']
const SKY = -1
const GROUND = 0
const GROUND_TOP = 1
const NET = 2
const BALL = 3
const YOU = 4
const CLAUDE = 5
const EYE = 6
const PUPIL = 7

const FLOOR = 4 // pixels of ground; feet stand on y = FLOOR
const NET_H = 17
const BALL_R = 3
const GRAVITY = 155
const COURT_ROWS = 24

type Court = {
  instance: string
  stop: () => void
  tickMs: number
  last: number
  t: number
  you: number
  pointer: number
  claude: number
  ballX: number
  ballY: number
  vx: number
  vy: number
  // the current second
  windowStart: number
  ticks: number
  renders: number
  lastRender: number
  gaps: number[]
  renderMs: number[]
  chars: number
  nodes: number
  stats: string
}

type Held = { court: Court; frame: number }

function now(): number {
  return performance.now()
}

const round = (ms: number) => Math.round(ms * 10) / 10

function step(c: Court, width: number, height: number, dt: number): void {
  c.t += dt
  const half = width / 2
  const speed = half / 1.3

  // Your blob runs toward the pointer's column at the game's run speed, as PointerSource will.
  const target = Math.min(half - 5, Math.max(4, c.pointer < 0 ? width / 4 : c.pointer))
  const reach = speed * dt
  c.you += Math.max(-reach, Math.min(reach, target - c.you))
  c.claude = (3 * width) / 4 + Math.sin(c.t * 1.3) * (width / 8)

  c.vy -= GRAVITY * dt
  c.ballX += c.vx * dt
  c.ballY += c.vy * dt
  if (c.ballX < BALL_R) {
    c.ballX = BALL_R
    c.vx = Math.abs(c.vx)
  }
  if (c.ballX > width - BALL_R) {
    c.ballX = width - BALL_R
    c.vx = -Math.abs(c.vx)
  }
  if (c.ballY - BALL_R < FLOOR + NET_H && Math.abs(c.ballX - half) < BALL_R + 1) {
    c.vx = c.ballX < half ? -Math.abs(c.vx) : Math.abs(c.vx)
  }
  if (c.ballY < FLOOR + BALL_R) {
    // Bounce back up to near the top of the view, for ever.
    c.ballY = FLOOR + BALL_R
    c.vy = Math.sqrt(2 * GRAVITY * Math.max(10, height - FLOOR - 2 * BALL_R - 4))
  }
}

function paint(c: Court, width: number, height: number): Int8Array {
  const px = new Int8Array(width * height).fill(SKY)
  const set = (x: number, y: number, color: number) => {
    const col = Math.round(x)
    const row = height - 1 - Math.round(y)
    if (col >= 0 && col < width && row >= 0 && row < height) px[row * width + col] = color
  }

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < FLOOR - 1; y++) set(x, y, GROUND)
    set(x, FLOOR - 1, GROUND_TOP)
  }
  for (let y = FLOOR; y < FLOOR + NET_H; y++) {
    set(width / 2 - 1, y, NET)
    set(width / 2, y, NET)
  }
  const blob = (cx: number, color: number, facing: number) => {
    for (let y = 0; y <= 8; y++) {
      for (let x = -4; x <= 4; x++) {
        if ((x / 4.2) ** 2 + ((y - 4.25) / 4.5) ** 2 <= 1) set(cx + x, FLOOR + y, color)
      }
    }
    set(cx + facing, FLOOR + 6, EYE)
    set(cx + 2 * facing, FLOOR + 6, PUPIL)
  }
  blob(c.you, YOU, 1)
  blob(c.claude, CLAUDE, -1)
  for (let y = -BALL_R; y <= BALL_R; y++) {
    for (let x = -BALL_R; x <= BALL_R; x++) {
      if (x * x + y * y <= BALL_R * BALL_R) set(c.ballX + x, c.ballY + y, BALL)
    }
  }

  return px
}

type Run = { fg: number; bg: number; text: string }

// PLAN.md 6.7: two pixels per cell, sky sets no color, equal neighbours merge into one run.
function encode(px: Int8Array, width: number, rows: number): Run[][] {
  const out: Run[][] = []
  for (let r = 0; r < rows; r++) {
    const runs: Run[] = []
    let run: Run | undefined
    for (let x = 0; x < width; x++) {
      const top = px[2 * r * width + x] ?? SKY
      const bottom = px[(2 * r + 1) * width + x] ?? SKY
      let ch = ' '
      let fg = SKY
      let bg = SKY
      if (top !== SKY && bottom === SKY) {
        ch = '▀'
        fg = top
      } else if (top === SKY && bottom !== SKY) {
        ch = '▄'
        fg = bottom
      } else if (top !== SKY && top === bottom) {
        ch = '█'
        fg = top
      } else if (top !== SKY) {
        ch = '▀'
        fg = top
        bg = bottom
      }
      if (run !== undefined && run.fg === fg && run.bg === bg) {
        run.text += ch
      } else {
        run = { fg, bg, text: ch }
        runs.push(run)
      }
    }
    out.push(runs)
  }

  return out
}

function closeWindow(c: Court, t: number, props: CourtProps, surface: ClientSurface<Held>): void {
  const gaps = [...c.gaps].sort((a, b) => a - b)
  const ms = c.renderMs
  const window: CourtWindow = {
    ms: round(t - c.windowStart),
    ticks: c.ticks,
    renders: c.renders,
    maxGap: round(gaps[gaps.length - 1] ?? -1),
    p95Gap: round(gaps[Math.min(gaps.length - 1, Math.floor(0.95 * gaps.length))] ?? -1),
    renderMean: Math.round((ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)) * 100) / 100,
    renderMax: round(Math.max(0, ...ms)),
    chars: c.chars,
    nodes: c.nodes,
    columns: surface.columns,
    rows: surface.rows,
    tickMs: c.tickMs,
    working: props.working,
  }
  const report: CourtReport = { v: 1, instance: c.instance, window }
  surface.post(report)
  c.stats =
    `P2 court  ${window.renders} draws in ${window.ms} ms (ticks ${window.ticks}, every ${c.tickMs} ms)  ` +
    `gaps p95 ${window.p95Gap} max ${window.maxGap} ms  draw ${window.renderMean} ms (max ${window.renderMax})  ` +
    `tree ${(c.chars / 1000).toFixed(1)}k chars ${c.nodes} nodes  ${props.cpu}`
  c.windowStart = t
  c.ticks = 0
  c.renders = 0
  c.gaps = []
  c.renderMs = []
}

function start(c: Court, tickMs: number, surface: ClientSurface<Held>): void {
  c.stop()
  c.tickMs = tickMs
  c.stop = surface.every(tickMs, () => {
    const t = now()
    const width = Math.max(1, surface.columns)
    const height = 2 * COURT_ROWS
    step(c, width, height, Math.min(0.1, (t - c.last) / 1000))
    c.last = t
    c.ticks += 1
    surface.setState({ court: c, frame: c.ticks })
  })
}

function begin(surface: ClientSurface<Held>, props: CourtProps): Court {
  const t = now()
  const width = Math.max(60, surface.columns)
  const c: Court = {
    instance: crypto.randomUUID().slice(0, 8),
    stop: () => {},
    tickMs: props.tickMs,
    last: t,
    t: 0,
    you: width / 4,
    pointer: -1,
    claude: (3 * width) / 4,
    ballX: width / 4,
    ballY: 2 * COURT_ROWS - 6,
    vx: width / 2.2,
    vy: 0,
    windowStart: t,
    ticks: 0,
    renders: 0,
    lastRender: -1,
    gaps: [],
    renderMs: [],
    chars: 0,
    nodes: 0,
    stats: 'P2 court  first second still running',
  }
  start(c, props.tickMs, surface)
  surface.onPointer(e => {
    if (e.type === 'move' || e.type === 'down') c.pointer = e.x
  })
  surface.setState({ court: c, frame: 0 })

  return c
}

const P2Court: ClientModule<CourtProps, Held> = (props, surface) => {
  const c = surface.state?.court ?? begin(surface, props)
  if (props.tickMs !== c.tickMs) start(c, props.tickMs, surface)

  const t0 = now()
  if (c.lastRender >= 0) c.gaps.push(t0 - c.lastRender)
  c.lastRender = t0
  c.renders += 1

  const width = Math.max(1, surface.columns)
  const rows = Math.max(1, Math.min(COURT_ROWS, (surface.rows || COURT_ROWS + 1) - 1))
  const runs = encode(paint(c, width, 2 * COURT_ROWS), width, rows)

  const { Box, Text } = surface.elements
  let nodes = 2 + rows
  const lines = runs.map(row => {
    const children: RenderNode[] = row.map(run => {
      if (run.fg === SKY) return run.text
      nodes += 1

      return run.bg === SKY ? (
        <Text color={PALETTE[run.fg]}>{run.text}</Text>
      ) : (
        <Text color={PALETTE[run.fg]} backgroundColor={PALETTE[run.bg]}>
          {run.text}
        </Text>
      )
    })

    return <Text wrap="truncate">{children}</Text>
  })
  const tree = (
    <Box flexDirection="column">
      <Text wrap="truncate" dimColor>
        {c.stats}
      </Text>
      {lines}
    </Box>
  )
  c.renderMs.push(now() - t0)

  // Size the tree now and then, outside the draw time: the Client's bound is 100,000 characters.
  if (c.renders % 30 === 1) {
    c.chars = Math.max(c.chars, JSON.stringify(tree).length)
    c.nodes = Math.max(c.nodes, nodes)
  }
  if (t0 - c.windowStart >= 1000) closeWindow(c, t0, props, surface)

  return tree
}

export default P2Court
