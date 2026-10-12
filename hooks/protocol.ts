// What the two modules hand each other (PLAN.md 6.10), with no claude-code import, so both share
// it. Each field comes with the milestone that uses it: M5 brings the standing, the record, the
// pause command, the keys and the report; M7 the turn end (`doneSeq`, `closed`); M8 the new match
// of a reset, carried by the standing's number; M9 Claude's level.

import type { LevelName } from '../core/ai'
import type { MatchResult, Phase } from '../core/types'
import type { VolleyMatch, VolleyRecord } from '../types'
import type { KeyState } from './keys'

/** The hooks module to the court's Client. */
export type CourtProps = {
  v: 1
  /**
   * The standing at mount; the Client owns it while mounted. A higher `number` than the Client's
   * means the hooks module started a new match (/volley reset), and the Client takes it up.
   */
  match: VolleyMatch
  /** For the score row. */
  record: VolleyRecord
  /** Claude's level from /config (PLAN.md 6.9); a change swaps the level of the court's AI. */
  level: LevelName
  /** A higher `seq` than the Client has seen asks it to do `kind` once. */
  cmd: { seq: number; kind: 'none' | 'pause' }
  /**
   * Rises at a turn end that closes this court: it lets a rally in play run out and reports
   * `closed`. The value it mounts with counts as seen; a court /volley opened never sees it rise.
   */
  doneSeq: number
  /** The key helper's mask (PLAN.md 6.12). While it is not `ok` the mask is 0, so nothing moves your blob. */
  keys: KeyState
  /**
   * `wall` is real time. The test clocks count each frame tick as fixed time, so tests move the game
   * with the kit's frame clock: `tick` as 16 ms, `away` as 32.5 ms, the rate of a window in the
   * background.
   */
  clock: 'wall' | 'tick' | 'away'
  seed: number
}

/**
 * The Client to the hooks module, posted at every tick: always a full snapshot, so a post that a
 * later one replaced loses nothing.
 */
export type CourtReport = {
  v: 1
  frame: number
  phase: Phase
  match: VolleyMatch
  /** How the last match the Client saw end ended; with `match.number` it names that match. */
  lastMatch: MatchResult | null
  /** The highest `doneSeq` whose rally is over; once it reaches the latest, the court may close. */
  closed: number
}

const PHASES: readonly string[] = ['idle', 'countdown', 'rally', 'point', 'matchEnd', 'paused'] satisfies Phase[]

type Fields = Record<string, unknown>

function fields(value: unknown): Fields | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Fields) : null
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function side(value: unknown): value is 'you' | 'claude' {
  return value === 'you' || value === 'claude'
}

/** A standing as a report or the store carries it, or null for anything else. */
export function readMatch(value: unknown): VolleyMatch | null {
  const m = fields(value)
  if (!m || m.v !== 1 || !count(m.you) || !count(m.claude) || !side(m.server) || !count(m.number) || m.number < 1) return null

  return { v: 1, you: m.you, claude: m.claude, server: m.server, number: m.number }
}

/** A record as the store carries it, or null for anything else. */
export function readRecord(value: unknown): VolleyRecord | null {
  const r = fields(value)
  if (!r || r.v !== 1 || !count(r.won) || !count(r.lost) || !count(r.pointsFor) || !count(r.pointsAgainst)) return null

  return { v: 1, won: r.won, lost: r.lost, pointsFor: r.pointsFor, pointsAgainst: r.pointsAgainst }
}

function readResult(value: unknown): MatchResult | null | undefined {
  if (value === null) return null
  const r = fields(value)
  if (!r || !side(r.winner) || !count(r.you) || !count(r.claude)) return undefined

  return { winner: r.winner, you: r.you, claude: r.claude }
}

/** A report as the hooks module may trust it, or null for anything else a post could carry. */
export function readReport(data: unknown): CourtReport | null {
  const r = fields(data)
  if (!r || r.v !== 1 || !count(r.frame) || typeof r.phase !== 'string' || !PHASES.includes(r.phase) || !count(r.closed)) return null
  const match = readMatch(r.match)
  const lastMatch = readResult(r.lastMatch)
  if (!match || lastMatch === undefined) return null

  return { v: 1, frame: r.frame, phase: r.phase as Phase, match, lastMatch, closed: r.closed }
}
