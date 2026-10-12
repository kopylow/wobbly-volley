import { COUNTDOWN_STEPS, DONE_CUT_STEPS, MATCH_END_STEPS, POINT_STEPS, WIN_BY, WIN_POINTS, clampWidth } from './constants'
import { seedRng } from './rng'
import { newSim, other, serve, step } from './sim'
import type { Action, Game, GameEvent, Inputs, Match, MatchResult, Side } from './types'

// Phases, scoring, serve and match end (PLAN.md 6.4). `tick` and `dispatch` change the game in place
// and return what happened; the Client turns that into its report. Timers count steps.

/** A match at 0:0. You serve first in every new match (PLAN.md 3.2). */
export function newMatch(number = 1): Match {
  return { v: 1, you: 0, claude: 0, server: 'you', number }
}

/**
 * Rally scoring: the side gets the point and the serve. When that wins the match, the result comes
 * back and the standing starts the next match.
 */
export function awardPoint(match: Match, side: Side): MatchResult | null {
  match[side]++
  match.server = side
  if (match[side] < WIN_POINTS || match[side] - match[other(side)] < WIN_BY) return null

  const result = { winner: side, you: match.you, claude: match.claude }
  Object.assign(match, newMatch(match.number + 1))

  return result
}

/** A game waiting for the first click, the serve set up for the match's server. */
export function newGame(options: { w: number; match: Match; seed: number }): Game {
  const match = { ...options.match }

  return {
    phase: 'idle',
    timer: 0,
    sim: newSim(clampWidth(options.w), match.server),
    match,
    rng: seedRng(options.seed),
    cut: null,
    lastPoint: null,
    lastMatch: null,
  }
}

/** One step of the current phase. Only a rally moves the sim; every other phase is frozen. */
export function tick(game: Game, inputs: Inputs): GameEvent[] {
  switch (game.phase) {
    case 'countdown':
      // Whatever the sim holds goes on: a fresh serve, or the rally a pause froze.
      if (--game.timer <= 0) game.phase = 'rally'
      return []
    case 'rally':
      return playRally(game, inputs)
    case 'point':
      // The next serve follows at once; the countdown is only for a click.
      if (--game.timer <= 0) {
        serve(game.sim, game.match.server)
        game.phase = 'rally'
      }
      return []
    case 'matchEnd':
      if (--game.timer <= 0) {
        serve(game.sim, game.match.server)
        game.phase = 'idle'
      }
      return []
    case 'idle':
    case 'paused':
      return []
  }
}

export function dispatch(game: Game, action: Action): GameEvent[] {
  switch (action.kind) {
    case 'start':
      return start(game)
    case 'pause':
      return pause(game)
    case 'turnDone':
      return turnDone(game)
    case 'reset':
      return reset(game, action.match)
    case 'resize':
      return resize(game, action.w)
  }
}

function playRally(game: Game, inputs: Inputs): GameEvent[] {
  const { scored } = step(game.sim, inputs)
  if (scored === null) {
    if (game.cut === null || --game.cut > 0) return []
    return endRally(game)
  }

  const events: GameEvent[] = [{ kind: 'point', side: scored }]
  game.lastPoint = scored
  const result = awardPoint(game.match, scored)
  if (result) {
    game.lastMatch = result
    events.push({ kind: 'matchEnd', winner: result.winner })
  }
  if (game.cut !== null) return [...events, ...endRally(game)]

  // The sim stays frozen where the ball landed until the phase ends.
  game.phase = result ? 'matchEnd' : 'point'
  game.timer = result ? MATCH_END_STEPS : POINT_STEPS

  return events
}

/** The turn is over and so is the rally (D5): a rally still in the air is void. */
function endRally(game: Game): GameEvent[] {
  game.cut = null
  serve(game.sim, game.match.server)
  game.phase = 'paused'

  return [{ kind: 'rallyOver' }]
}

function start(game: Game): GameEvent[] {
  if (game.phase === 'matchEnd') serve(game.sim, game.match.server)
  if (game.phase === 'idle' || game.phase === 'paused' || game.phase === 'matchEnd') {
    game.phase = 'countdown'
    game.timer = COUNTDOWN_STEPS
  }

  return []
}

function pause(game: Game): GameEvent[] {
  // The hooks module waits for the rally after a turn end; a frozen one would never end.
  if (game.cut !== null) return endRally(game)
  if (game.phase === 'point') serve(game.sim, game.match.server)
  if (game.phase === 'countdown' || game.phase === 'rally' || game.phase === 'point') game.phase = 'paused'

  return []
}

function turnDone(game: Game): GameEvent[] {
  if (game.phase === 'rally') {
    if (game.cut === null) game.cut = DONE_CUT_STEPS
    return []
  }
  if (game.phase === 'countdown' || game.phase === 'point') {
    serve(game.sim, game.match.server)
    game.phase = 'paused'
  }

  return [{ kind: 'rallyOver' }]
}

/** The shell's new match replaces the standing; the match under way ends uncounted. */
function reset(game: Game, match: Match): GameEvent[] {
  const events: GameEvent[] = game.cut !== null ? [{ kind: 'rallyOver' }] : []
  Object.assign(game.match, match)
  Object.assign(game, { phase: 'idle', timer: 0, cut: null, lastPoint: null, lastMatch: null })
  serve(game.sim, game.match.server)

  return events
}

/** A new width voids the rally (PLAN.md 3.2): the same side serves again. */
function resize(game: Game, columns: number): GameEvent[] {
  const w = clampWidth(columns)
  if (w === game.sim.w) return []

  game.sim.w = w
  serve(game.sim, game.match.server)
  if (game.phase !== 'rally') return []
  if (game.cut !== null) return endRally(game)
  game.phase = 'countdown'
  game.timer = COUNTDOWN_STEPS

  return []
}
