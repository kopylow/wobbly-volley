import type { ClientKeyEvent, ClientModule, ClientPointerEvent, ClientSurface } from 'claude-code'

import { AiSource, LEVELS } from '../core/ai'
import { DT, clampWidth } from '../core/constants'
import { BLOB_COLOR, PALETTE, courtSize, draw } from '../core/draw'
import { encodeRuns } from '../core/encode'
import type { Run } from '../core/encode'
import { dispatch, newGame, tick } from '../core/game'
import { KEY_BITS, KeysSource, STAND } from '../core/input'
import type { Game, Phase } from '../core/types'
import { FocusWatch } from './focus'
import type { CourtProps, CourtReport } from './protocol'

// The court, drawing thread (PLAN.md 6.8). It owns the running game: it steps it by the time that
// passed, asks your keys and the AI for their inputs, draws it on every tick and reports the
// standing to the hooks module, whose answer brings the next props, the helper's keys among them.

/** The frame clock's interval. */
const TICK_MS = 16
/** What one tick counts for under the test clocks (CourtProps). */
const TEST_TICKS: Record<CourtProps['clock'], number> = { wall: 0, tick: TICK_MS, away: 32.5 }
const STEP_MS = DT * 1000
/** Steps one tick may run; a longer gap is dropped, not caught up. */
const MAX_STEPS = 5
/**
 * A key the helper sees go down must reach the court as a press within this time, or the keys are
 * going somewhere else (PLAN.md 6.8). The press comes 3 ms before to 9 ms after the helper's (P4).
 */
const PRESS_MS = 150

const BLUE = PALETTE[BLOB_COLOR.you] ?? undefined
const ORANGE = PALETTE[BLOB_COLOR.claude] ?? undefined

/** The hint row while the rally after a turn end runs out (D5). Every hint fits the narrowest court. */
export const DONE = 'Claude is done: this rally plays out, then the court closes.'

/** The letters the helper watches, by the bit of its mask. */
const WATCHED = [
  ['a', KEY_BITS.left],
  ['d', KEY_BITS.right],
  ['w', KEY_BITS.jump],
] as const
type Watched = (typeof WATCHED)[number][0]

/** Key names `onKey` gives besides typed text; none of them is a press of A, D or W. */
const NAMED = new Set(['up', 'down', 'left', 'right', 'return', 'enter', 'tab', 'backspace', 'delete', 'insert', 'pageup', 'pagedown', 'home', 'end', 'space', 'escape'])

/** What the hint row says, by phase and by whether the key helper is trusted; at most 60 characters. */
export function hint(phase: Phase, helper: boolean): string {
  if (phase === 'matchEnd') return 'Click for the next match. /volley hides the court.'
  if (phase === 'paused') return 'Click to resume. /volley hides the court.'
  // It starts with the court and is ready in about a second (P4).
  if (!helper) return 'Waiting for the key helper; then A and D run, W jumps.'
  if (phase === 'idle') return 'Click to play. A and D run, W jumps; hold W to jump higher.'

  // Once: a second Esc interrupts Claude's turn (PLAN.md section 7).
  return 'A and D run, W jumps. Esc once hands the keys to the prompt.'
}

/** A run's attributes for its Text: its colours, and a pulsing line's weight as bold or dim. */
function style(run: Run): { color?: string; backgroundColor?: string; bold?: boolean; dimColor?: boolean } {
  const props: { color?: string; backgroundColor?: string; bold?: boolean; dimColor?: boolean } = {}
  if (run.fg !== undefined) props.color = run.fg
  if (run.bg !== undefined) props.backgroundColor = run.bg
  if (run.weight === 'bold') props.bold = true
  if (run.weight === 'dim') props.dimColor = true

  return props
}

type Court = {
  game: Game
  /** Your blob: the helper's held keys (D3). */
  keys: KeysSource
  claude: AiSource
  focus: FocusWatch
  clock: CourtProps['clock']
  /** The time of the last tick, and the time not yet stepped, in ms. */
  last: number
  owed: number
  frame: number
  /** The region has no room for the court: the game is paused and holds its width until it has. */
  held: boolean
  /** The helper is trusted (`props.keys.ok`), and its last trusted mask, to find keys going down. */
  helper: boolean
  mask: number
  /** When each watched letter last reached `onKey`, and since when a key that went down waits for one. */
  pressed: Record<Watched, number>
  waiting: Record<Watched, number | null>
  /** The highest command `seq` seen, so each command is done once. */
  cmd: number
  /** The highest turn end taken, and the highest whose rally is over (PLAN.md 6.10). */
  done: number
  closed: number
}

type Held = { court: Court; frame: number }

/** The court's time base: real time, or the test clock's sum of ticks. */
function now(c: Court): number {
  return c.clock === 'wall' ? performance.now() : c.last
}

/**
 * The keys left the court: play pauses (PLAN.md 6.8). Only a click resumes, and a click hands the
 * court the keyboard, so a running rally always has it and the helper's keys may move the blob.
 */
function keysLeft(c: Court): void {
  dispatch(c.game, { kind: 'pause' })
}

function onTick(c: Court, surface: ClientSurface<Held>): void {
  const t = c.clock === 'wall' ? performance.now() : c.last + TEST_TICKS[c.clock]
  const passed = t - c.last
  c.last = t
  // The window went to the background: the frame clock dropped to its background rate.
  if (c.focus.gap(passed)) dispatch(c.game, { kind: 'pause' })
  // A key went down at the helper and no press of it reached the court: the keys go elsewhere.
  for (const [letter] of WATCHED) {
    const since = c.waiting[letter]
    if (since === null) continue
    if (c.pressed[letter] >= since - PRESS_MS) c.waiting[letter] = null
    else if (t - since > PRESS_MS) {
      c.waiting[letter] = null
      keysLeft(c)
    }
  }

  if (!c.held) {
    c.owed = Math.min(MAX_STEPS * STEP_MS, c.owed + passed)
    for (; c.owed >= STEP_MS; c.owed -= STEP_MS) step(c)
  }
  c.frame += 1
  // No rally runs out any more: the turn ends taken so far are over, and the court may close.
  if (c.game.cut === null) c.closed = c.done
  // Every tick, also when nothing changed: the answer is how fresh props reach the court.
  surface.post(report(c))
  surface.setState({ court: c, frame: c.frame })
}

function step(c: Court): void {
  const { game } = c
  // Only a rally moves the sim, so only a rally asks the inputs; a paused court spares the AI's planning.
  const playing = game.phase === 'rally'
  // Your blob moves by the helper's keys alone (D3), so the rally holds still while the helper is not
  // trusted, and goes on by itself once it is: a reload of the hooks module ends the helper, and the
  // next one is ready about a second later. The cut after a turn end counts steps and waits too.
  if (playing && !c.helper) return
  tick(game, { you: playing ? c.keys.next() : STAND, claude: playing ? c.claude.next(game, 'claude') : STAND })
}

function report(c: Court): CourtReport {
  const { phase, match, lastMatch } = c.game

  return { v: 1, frame: c.frame, phase, match, lastMatch, closed: c.closed }
}

/**
 * The helper's mask from the props. Esc going down or the terminal leaving the front pauses; a
 * watched key going down waits for its press. Changes only: the props a click meets may be a frame
 * old, and the window it brought to the front must not count as gone. A helper not trusted says
 * nothing about either: its mask is 0 while it starts, and a reload starts a new one (PLAN.md 6.12).
 */
function takeKeys(c: Court, keys: CourtProps['keys']): void {
  c.helper = keys.ok
  c.keys.mask = keys.mask
  if (!keys.ok) return
  const { mask } = keys
  const down = (bit: number) => (mask & bit) !== 0 && (c.mask & bit) === 0
  const up = (bit: number) => (mask & bit) === 0 && (c.mask & bit) !== 0
  if (down(KEY_BITS.esc) || up(KEY_BITS.front)) keysLeft(c)
  for (const [letter, bit] of WATCHED) if (down(bit)) c.waiting[letter] = now(c)
  c.mask = mask
}

function onPointer(c: Court, e: ClientPointerEvent): void {
  // Without room the region is a line of text, not the court.
  if (c.held || e.type !== 'down' || e.button !== 'left') return
  // A click hands the court the keyboard, and starts, resumes or opens the next match (PLAN.md 6.4).
  dispatch(c.game, { kind: 'start' })
}

/** One event may carry several typed letters (P1); a named key is none of them. */
function letters(e: ClientKeyEvent): string[] {
  if (e.ctrl || e.meta || NAMED.has(e.key) || /^f\d+$/.test(e.key)) return []

  return [...e.key.toLowerCase()]
}

/** The presses themselves move nothing; they show the 150 ms rule that the keys reach the court. */
function onKey(c: Court, e: ClientKeyEvent): void {
  for (const letter of letters(e)) if (letter === 'a' || letter === 'd' || letter === 'w') c.pressed[letter] = now(c)
}

function begin(props: CourtProps, surface: ClientSurface<Held>): Court {
  const c: Court = {
    game: newGame({ w: clampWidth(surface.columns), match: props.match, seed: props.seed }),
    keys: new KeysSource(),
    claude: new AiSource(LEVELS[props.level], props.seed + 1),
    focus: new FocusWatch(),
    clock: props.clock,
    last: props.clock === 'wall' ? performance.now() : 0,
    owed: 0,
    frame: 0,
    held: false,
    helper: false,
    mask: 0,
    pressed: { a: -Infinity, d: -Infinity, w: -Infinity },
    waiting: { a: null, d: null, w: null },
    // A command or a turn end sent before this court mounted is not for it.
    cmd: props.cmd.seq,
    done: props.doneSeq,
    closed: props.doneSeq,
  }
  surface.every(TICK_MS, () => onTick(c, surface))
  surface.onPointer(e => onPointer(c, e))
  surface.onKey(e => onKey(c, e))
  surface.setState({ court: c, frame: 0 })

  return c
}

const VolleyCourt: ClientModule<CourtProps, Held> = (props, surface) => {
  const c = surface.state?.court ?? begin(props, surface)
  const { Box, Text } = surface.elements

  // The hooks module started a new match (/volley reset): its standing is ahead of the court's,
  // which otherwise owns the match while mounted and runs ahead of the props (PLAN.md 6.8).
  if (props.match.number > c.game.match.number) dispatch(c.game, { kind: 'reset', match: props.match })
  // The hooks module saw the keyboard leave for the prompt (PLAN.md 6.9, prompt.edit).
  if (props.cmd.seq > c.cmd) {
    c.cmd = props.cmd.seq
    if (props.cmd.kind === 'pause') keysLeft(c)
  }
  // The turn ended: a rally in play runs out under the cut, any other phase pauses (D5, PLAN.md 6.4).
  if (props.doneSeq > c.done) {
    c.done = props.doneSeq
    dispatch(c.game, { kind: 'turnDone' })
  }
  takeKeys(c, props.keys)
  // The level changed in /config (PLAN.md 6.8): the AI plays on at the new one, under its name.
  if (props.level !== c.claude.level.name) c.claude.level = LEVELS[props.level]

  // The band gives a region too small for the court one row: the game pauses and keeps its width,
  // so a click after the room is back resumes the rally where it stopped (PLAN.md 3.2).
  const size = courtSize(surface.columns, surface.rows)
  if (typeof size !== 'object') {
    if (!c.held) dispatch(c.game, { kind: 'pause' })
    c.held = true
    return <Text wrap="truncate">{`Wobbly Volley needs a ${size} window`}</Text>
  }
  c.held = false

  // A new width voids a rally under way; the same side serves again (PLAN.md 3.2).
  if (size.columns !== c.game.sim.w) dispatch(c.game, { kind: 'resize', w: size.columns })

  const { level } = c.claude
  const runs = encodeRuns(draw(c.game, { rows: size.rows, rival: level.player }), PALETTE)
  const { you: mine, claude } = c.game.match
  const { won, lost } = props.record

  return (
    <Box flexDirection="column">
      <Text wrap="truncate">
        <Text bold color={BLUE}>
          You
        </Text>
        {` ${mine} : ${claude} `}
        <Text bold color={ORANGE}>
          {level.player}
        </Text>
        <Text dimColor>{`   ${level.name}   matches won ${won}, lost ${lost}`}</Text>
      </Text>
      {runs.map(row => (
        <Text wrap="truncate">
          {row.map(run => (run.fg === undefined && run.weight === undefined ? run.text : <Text {...style(run)}>{run.text}</Text>))}
        </Text>
      ))}
      {c.game.cut !== null ? (
        <Text bold color={ORANGE} wrap="truncate">
          {DONE}
        </Text>
      ) : (
        <Text dimColor wrap="truncate">
          {hint(c.game.phase, c.helper)}
        </Text>
      )}
    </Box>
  )
}

export default VolleyCourt
