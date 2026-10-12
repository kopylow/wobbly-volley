import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { newMatch } from '../core/game'
import type { CourtReport } from '../hooks/protocol'
import type { VolleyMatch, VolleyRecord } from '../types'
import { appeared, court, engine, lines, message, mount, reopen, serve, started, toggle, typeIntoPrompt, untilPoint, volley } from './kit'
import type { Kit } from './kit'

// The standing across sessions (PLAN.md 6.11, D7): every point in `$.store`, the record counted
// against it, and the new match of a reset reaching a shown court. Most reports here are posted by
// the test as the court would post them, while the court's own frame clock stands still.

const RECORD: VolleyRecord = { v: 1, won: 2, lost: 1, pointsFor: 45, pointsAgainst: 38 }

function at(you: number, claude: number, number = 1): VolleyMatch {
  return { ...newMatch(number), you, claude }
}

/** The court's report of a standing; with `lastMatch` the match before it has just ended. */
function report(match: VolleyMatch, lastMatch: CourtReport['lastMatch'] = null): CourtReport {
  return { v: 1, frame: 1000, phase: lastMatch === null ? 'point' : 'matchEnd', match, lastMatch, closed: 0 }
}

function post(k: Kit, data: CourtReport): Promise<void> {
  return k.band.post(data, { in: 'court' })
}

async function scoreRow(k: Kit): Promise<string | undefined> {
  return (await lines(k.band))[0]
}

/** The session ends: an exit, or /clear. */
function end($: Engine, reason: 'prompt_input_exit' | 'clear' = 'prompt_input_exit'): Promise<unknown> {
  return $.session.end({ reason, sessionId: 's1', resume: { id: 's1' } })
}

test('store: the point a rally ends in is saved', async ($, on) => {
  const k = await court($, on)
  await serve(k)
  expect(await untilPoint(k)).toBeLessThan(60)

  const [, you = '', claude = ''] = /^You (\d+) : (\d+) Jelly/.exec((await scoreRow(k)) ?? '') ?? []
  expect(k.store.map.get('match')).toMatchObject({ v: 1, you: Number(you), claude: Number(claude), number: 1 })
})

test('store: a court opened in a new session shows the saved standing and record', async ($, on) => {
  const k = await court($, on, { saved: { match: { ...at(4, 7, 3), server: 'claude' }, record: RECORD } })

  expect(await scoreRow(k)).toBe('You 4 : 7 Jelly   medium   matches won 2, lost 1')
})

test('store: a match end counts once, onto what another session counted meanwhile', async ($, on) => {
  const k = await court($, on, { saved: { match: at(10, 3), record: RECORD } })
  k.store.map.set('record', { ...RECORD, won: 5, pointsFor: 60 })

  await post(k, report(newMatch(2), { winner: 'you', you: 11, claude: 3 }))
  await post(k, report(newMatch(2), { winner: 'you', you: 11, claude: 3 }))
  expect(k.store.map.get('record')).toEqual({ v: 1, won: 6, lost: 1, pointsFor: 71, pointsAgainst: 41 })
  expect(k.store.map.get('match')).toEqual(newMatch(2))

  // The court's own reports still say match 1; it takes the session's match 2 up from its props.
  await k.band.advance(64)
  expect(await scoreRow(k)).toBe('You 0 : 0 Jelly   medium   matches won 6, lost 1')
})

test('store: the court opening shows the matches other sessions counted since', async ($, on) => {
  const k = await court($, on, { saved: { record: RECORD } })
  expect(await scoreRow(k)).toBe('You 0 : 0 Jelly   medium   matches won 2, lost 1')

  k.store.map.set('record', { ...RECORD, won: 4 })
  const again = await reopen(k)
  expect(await scoreRow(again)).toBe('You 0 : 0 Jelly   medium   matches won 4, lost 1')

  // /volley on opens a court the same way; the band is mounted anew for a fresh court (tests/kit.ts).
  await toggle($)
  await again.band.unmount()
  k.store.map.set('record', { ...RECORD, won: 5 })
  await volley($, 'on')
  const band = await mount($)
  await band.resize({ columns: 110, rows: 26 })
  expect(await scoreRow({ ...again, band })).toBe('You 0 : 0 Jelly   medium   matches won 5, lost 1')
})

test('store: /volley reset shows 0 : 0 on the court at once, typing after it or not; the old match is not taken back', async ($, on) => {
  const k = await court($, on, { saved: { match: at(3, 2), record: RECORD } })
  expect(await scoreRow(k)).toBe('You 3 : 2 Jelly   medium   matches won 2, lost 1')

  await volley($, 'reset')
  // Typing raises the pause command, which takes the one command slot; the reset does not need it.
  await typeIntoPrompt($)
  await k.band.advance(64)
  expect(await scoreRow(k)).toBe('You 0 : 0 Jelly   medium   matches won 2, lost 1')
  expect(await message(k.band)).toContain('Click to play')

  // A report the court sent before it took the new match up arrives late.
  await post(k, report(at(4, 2)))
  expect(k.store.map.get('match')).toEqual(newMatch(2))
  expect(await volley($, 'stats')).toBe('Wobbly Volley: match 2 stands at You 0 : 0 Jelly. All time: 2 won, 1 lost, points 45 : 38')
})

test('store: a court that opens by itself in a session with no standing yet, as after /clear, shows the saved one', async ($, on) => {
  // Match 1: a court at a fresh match 1 would not take it up by the number, and would save 0 : 0 over it.
  const saved = { ...at(4, 7), server: 'claude' as const }
  const k = await appeared($, on, { saved: { match: saved, record: RECORD } })

  expect(await scoreRow(k)).toBe('You 4 : 7 Jelly   medium   matches won 2, lost 1')
  expect(k.store.map.get('match')).toEqual(saved)
})

test('store: a failed write costs the court nothing; the next save and the session end save what it left', async ($, on) => {
  const k = await court($, on)

  k.store.fail = 1
  // The hook still answers the court: a hook that threw would leave the post unanswered and fail it.
  await post(k, report(at(1, 0)))
  expect(k.store.map.has('match')).toBe(false)
  expect(await volley($, 'stats')).toContain('match 1 stands at You 1 : 0 Jelly')

  await post(k, report(at(2, 0)))
  expect(k.store.map.get('match')).toEqual(at(2, 0))

  k.store.fail = 1
  await post(k, report(at(3, 0)))
  await end($, 'clear')
  expect(k.store.map.get('match')).toEqual(at(3, 0))

  // Saved, it is no longer pending: the next session end leaves what another session saved since.
  k.store.map.set('match', at(5, 5))
  await end($)
  expect(k.store.map.get('match')).toEqual(at(5, 5))
})

test('store: a record not saved yet counts before the older one in the store', async ($, on) => {
  const k = await court($, on, { saved: { match: at(10, 3), record: RECORD } })

  k.store.fail = 1
  await post(k, report(newMatch(2), { winner: 'you', you: 11, claude: 3 }))
  expect(k.store.map.get('record')).toEqual(RECORD)
  expect(await volley($, 'stats')).toBe('Wobbly Volley: match 2 stands at You 0 : 0 Jelly. All time: 3 won, 1 lost, points 56 : 41')

  await end($)
  expect(k.store.map.get('record')).toEqual({ v: 1, won: 3, lost: 1, pointsFor: 56, pointsAgainst: 41 })
})

test('store: a report still being taken as the session ends: its failed write is tried once more', async ($, on) => {
  const k = await court($, on)
  let open = () => {}
  k.store.gate = new Promise<void>(resolve => (open = resolve))
  k.store.fail = 1

  const posting = post(k, report(at(1, 0)))
  // The report's write waits at the gate when the session ends.
  await k.clock.settle()
  expect(k.store.held).toBe(1)
  const ending = end($)
  k.store.gate = null
  open()
  await Promise.all([posting, ending])
  expect(k.store.map.get('match')).toEqual(at(1, 0))
})

test('store: a store that cannot be read: the court opens with a fresh match, and the next point is saved over it', async ($, on) => {
  const { clock, stub, store } = engine(on, { saved: { match: at(4, 7, 3), record: RECORD } })
  store.unreadable = true
  await toggle($)
  const band = await mount($)
  await band.resize({ columns: 110, rows: 26 })
  const k: Kit = { $, band, clock, stub, store }
  await started(k)
  expect(await scoreRow(k)).toBe('You 0 : 0 Jelly   medium   matches won 0, lost 0')

  await post(k, report(at(1, 0)))
  expect(store.map.get('match')).toEqual(at(1, 0))
  expect(await volley($, 'stats')).toBe('Wobbly Volley: match 1 stands at You 1 : 0 Jelly. All time: 0 won, 0 lost, points 0 : 0')
})

test('store: a session end with nothing left to save writes nothing', async ($, on) => {
  const k = await court($, on)
  await post(k, report(at(1, 0)))
  const writes = k.store.writes

  // Another session saved a later standing since: an idle session leaving must not write over it.
  k.store.map.set('match', at(5, 5))
  await end($, 'clear')
  expect(k.store.writes).toBe(writes)
  expect(k.store.map.get('match')).toEqual(at(5, 5))
})
