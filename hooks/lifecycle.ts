// The turn lifecycle's pure parts (PLAN.md 6.9): the settings as /config hands them, and what a
// fresh load of the hooks module does with the band and the turn it finds. No claude-code import,
// so tests drive it; the timers and the state writes need `$` and live in register.tsx.

import type { LevelName } from '../core/ai'
import type { VolleyBand, VolleyTurn } from '../types'

/** The `/config` rows: what the lifecycle reads, and Claude's level for the court. */
export type Settings = { enabled: boolean; delayMs: number; level: LevelName }

/** `delaySeconds` in plugin.json: its default and its bounds. */
const DELAY_S = 5
const MAX_DELAY_S = 60

/** The settings from the options `register` gets; a value of another shape reads as its default. */
export function readSettings(options: Readonly<Record<string, unknown>>): Settings {
  const { enabled, delaySeconds, difficulty } = options
  const delay = typeof delaySeconds === 'number' && Number.isFinite(delaySeconds) ? Math.min(MAX_DELAY_S, Math.max(0, delaySeconds)) : DELAY_S
  // `difficulty` in plugin.json: a picker over the three levels, medium by default.
  const level = difficulty === 'easy' || difficulty === 'hard' ? difficulty : 'medium'

  return { enabled: typeof enabled === 'boolean' ? enabled : true, delayMs: delay * 1000, level }
}

/** What a fresh load does: close the court, let its rally run out, show it after `ms`, or nothing. */
export type AfterLoad = { kind: 'close' } | { kind: 'finish' } | { kind: 'arm'; ms: number } | { kind: 'none' }

/**
 * A reload drops the module's timers (PLAN.md 6.11), so a fresh load picks the lifecycle up from
 * `$.state`. A turn that saved a file in the plugin's folder reloads the module as it ends (5.1 row
 * 27), so a court that opened by itself and whose turn ended lets its rally run out, as at any turn
 * end (D5); with the setting gone off it closes. A turn still running waits out what is left of its
 * delay. A court /volley opened stays (PLAN.md 3.2).
 */
export function afterLoad(at: { turn: VolleyTurn | undefined; band: VolleyBand; settings: Settings; now: number }): AfterLoad {
  const { turn, band, settings, now } = at
  if (band.mode === 'court') {
    if (band.manual || (turn?.working === true && settings.enabled)) return { kind: 'none' }
    return settings.enabled && turn !== undefined ? { kind: 'finish' } : { kind: 'close' }
  }
  if (turn?.working !== true || !settings.enabled || band.muted) return { kind: 'none' }

  return { kind: 'arm', ms: Math.max(0, turn.startedAt + settings.delayMs - now) }
}
