import { expect, test } from 'claude-code/testing'

import { newMatch } from '../core/game'
import { NO_RECORD, readArgs, resetLine, same, statsLine, tally } from '../hooks/standing'

// The standing's pure parts (PLAN.md 6.9): the record after a match, and the words of /volley.

test('standing: a finished match counts its result and its points into the record', () => {
  const once = tally(NO_RECORD, { winner: 'you', you: 11, claude: 7 })
  expect(once).toEqual({ v: 1, won: 1, lost: 0, pointsFor: 11, pointsAgainst: 7 })
  expect(tally(once, { winner: 'claude', you: 12, claude: 14 })).toEqual({ v: 1, won: 1, lost: 1, pointsFor: 23, pointsAgainst: 21 })
})

test('standing: two standings are the same when every field is', () => {
  const at = newMatch(3)
  expect(same(at, { ...at })).toBe(true)
  for (const change of [{ you: 1 }, { claude: 1 }, { server: 'claude' as const }, { number: 4 }]) expect(same(at, { ...at, ...change })).toBe(false)
})

test('standing: /volley alone toggles; on, off, reset and stats in any case and spacing; anything else is unknown', () => {
  expect(readArgs('')).toBe('toggle')
  expect(readArgs('   ')).toBe('toggle')
  expect(readArgs('on')).toBe('on')
  expect(readArgs(' OFF ')).toBe('off')
  expect(readArgs('Reset')).toBe('reset')
  expect(readArgs('stats\n')).toBe('stats')
  for (const args of ['toggle', 'on off', 'resets', 'stat', 'help']) expect(readArgs(args)).toBeNull()
})

test('standing: the reset and stats lines', () => {
  expect(resetLine(newMatch(7))).toBe('Wobbly Volley: match 7 starts at 0 : 0; the record stays')
  expect(statsLine({ v: 1, you: 10, claude: 9, server: 'you', number: 12 }, { v: 1, won: 6, lost: 5, pointsFor: 120, pointsAgainst: 118 }, 'Gummy')).toBe(
    'Wobbly Volley: match 12 stands at You 10 : 9 Gummy. All time: 6 won, 5 lost, points 120 : 118',
  )
})
