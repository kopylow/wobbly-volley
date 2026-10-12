// The standing's pure parts (PLAN.md 6.9, 6.11): the record after a finished match, and the words
// and answers of /volley. No claude-code import, so tests drive it; the reads and writes of
// `$.state` and `$.store` need `$` and live in register.tsx.

import type { MatchResult } from '../core/types'
import type { VolleyMatch, VolleyRecord } from '../types'

export const NO_RECORD: VolleyRecord = { v: 1, won: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 }

export function same(a: VolleyMatch, b: VolleyMatch): boolean {
  return a.you === b.you && a.claude === b.claude && a.server === b.server && a.number === b.number
}

/** The record after a finished match: its result and its points. */
export function tally(record: VolleyRecord, result: MatchResult): VolleyRecord {
  const won = result.winner === 'you'

  return {
    v: 1,
    won: record.won + (won ? 1 : 0),
    lost: record.lost + (won ? 0 : 1),
    pointsFor: record.pointsFor + result.you,
    pointsAgainst: record.pointsAgainst + result.claude,
  }
}

/** What /volley is asked to do: alone it toggles the court (PLAN.md 3.2); an unknown word is null. */
export type Word = 'toggle' | 'on' | 'off' | 'reset' | 'stats'

export function readArgs(args: string): Word | null {
  const word = args.trim().toLowerCase()
  if (word === '') return 'toggle'

  return word === 'on' || word === 'off' || word === 'reset' || word === 'stats' ? word : null
}

/** The answers of /volley, one short line each: the model reads them too (PLAN.md 5.1 row 17). */
export const SHOWN = 'Wobbly Volley: court shown'
export const HIDDEN = 'Wobbly Volley: court hidden'
export const MUTED = 'Wobbly Volley: court hidden; it does not open by itself again in this session (/volley on undoes that)'

export function usage(version: string): string {
  return `Wobbly Volley ${version}: /volley shows or hides the court; /volley on, off, reset or stats`
}

export function resetLine(match: VolleyMatch): string {
  return `Wobbly Volley: match ${match.number} starts at ${match.you} : ${match.claude}; the record stays`
}

/** `rival` is the name the AI plays under at the level of /config. */
export function statsLine(match: VolleyMatch, record: VolleyRecord, rival: string): string {
  const { won, lost, pointsFor, pointsAgainst } = record

  return `Wobbly Volley: match ${match.number} stands at You ${match.you} : ${match.claude} ${rival}. All time: ${won} won, ${lost} lost, points ${pointsFor} : ${pointsAgainst}`
}
