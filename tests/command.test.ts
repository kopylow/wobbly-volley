import { expect, test } from 'claude-code/testing'
import type { CommandSpec } from 'claude-code'

import { newMatch } from '../core/game'
import { VERSION } from '../hooks/register'
import type { VolleyMatch, VolleyRecord } from '../types'
import { engine, sessions, toggle, volley } from './kit'

// /volley in all its forms (PLAN.md 6.9, 3.2), and the standing it reads, whether the session
// started with this load or, as after /clear, it did not.

const MATCH: VolleyMatch = { v: 1, you: 4, claude: 7, server: 'claude', number: 3 }
const RECORD: VolleyRecord = { v: 1, won: 2, lost: 1, pointsFor: 45, pointsAgainst: 38 }
const STATS = 'Wobbly Volley: match 3 stands at You 4 : 7 Jelly. All time: 2 won, 1 lost, points 45 : 38'

test('/volley alone shows the court, then hides it', async ($, on) => {
  engine(on)

  expect(await toggle($)).toBe('Wobbly Volley: court shown')
  expect(await toggle($)).toBe('Wobbly Volley: court hidden')
  expect(await toggle($)).toBe('Wobbly Volley: court shown')
})

test('/volley with an unknown word says what it takes', async ($, on) => {
  engine(on)
  for (const args of ['version', 'on off', 'resets', 'help']) {
    expect(await volley($, args)).toBe(`Wobbly Volley ${VERSION}: /volley shows or hides the court; /volley on, off, reset or stats`)
  }
})

test('/volley off and on answer in one line each', async ($, on) => {
  engine(on)

  expect(await volley($, 'off')).toBe('Wobbly Volley: court hidden; it does not open by itself again in this session (/volley on undoes that)')
  expect(await volley($, ' ON ')).toBe('Wobbly Volley: court shown')
})

test('/volley stats after a restart: the standing and the record an earlier session saved', async ($, on) => {
  const { store } = engine(on, { saved: { match: MATCH, record: RECORD } })
  await sessions(on)($)

  // Another session saves a later standing: this one plays on with its own.
  store.map.set('match', { ...MATCH, you: 9 })
  expect(await volley($, 'stats')).toBe(STATS)
})

test('/volley stats with no session start, as after /clear: the saved standing', async ($, on) => {
  engine(on, { saved: { match: MATCH, record: RECORD } })

  expect(await volley($, ' stats ')).toBe(STATS)
})

test('/volley stats names the AI as the level of /config does', { options: { difficulty: 'easy' } }, async ($, on) => {
  engine(on, { saved: { match: MATCH, record: RECORD } })

  expect(await volley($, 'stats')).toBe(STATS.replace('Jelly', 'Pudding'))
})

test('/volley stats counts in the record other sessions saved since', async ($, on) => {
  const { store } = engine(on, { saved: { match: MATCH, record: RECORD } })
  await sessions(on)($)

  store.map.set('record', { ...RECORD, won: 3, pointsFor: 56 })
  expect(await volley($, 'stats')).toBe('Wobbly Volley: match 3 stands at You 4 : 7 Jelly. All time: 3 won, 1 lost, points 56 : 38')
})

test('/volley reset starts the next match at 0 : 0 and keeps the record', async ($, on) => {
  const { store } = engine(on, { saved: { match: MATCH, record: RECORD } })

  expect(await volley($, 'reset')).toBe('Wobbly Volley: match 4 starts at 0 : 0; the record stays')
  expect(store.map.get('match')).toEqual(newMatch(4))
  expect(store.map.get('record')).toEqual(RECORD)
  expect(await volley($, 'stats')).toBe('Wobbly Volley: match 4 stands at You 0 : 0 Jelly. All time: 2 won, 1 lost, points 45 : 38')
})

test('a saved value of an unknown version reads as a fresh one, which the next save replaces', async ($, on) => {
  const { store } = engine(on, { saved: { match: { ...MATCH, v: 2 }, record: { ...RECORD, v: 2 } } })

  expect(await volley($, 'stats')).toBe('Wobbly Volley: match 1 stands at You 0 : 0 Jelly. All time: 0 won, 0 lost, points 0 : 0')
  await volley($, 'reset')
  expect(store.map.get('match')).toEqual(newMatch(2))
})

test('session.start registers /volley to run during a turn', async ($, on) => {
  engine(on)
  const seen: CommandSpec[] = []
  on('command.register', ($, e) => {
    seen.push(e)

    return { value: { command: e.name } }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  await $.session.start({ cwd: 'C:/projects/ClaudeyVolley', surface: 'terminal', isInteractive: true })

  expect(seen).toEqual([
    {
      name: 'volley',
      description: 'Wobbly Volley: show or hide the court',
      argumentHint: '[on|off|reset|stats]',
      immediate: true,
    },
  ])
})
