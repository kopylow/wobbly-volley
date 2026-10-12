import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import { afterLoad, readSettings } from '../hooks/lifecycle'
import type { Settings } from '../hooks/lifecycle'
import type { VolleyBand, VolleyTurn } from '../types'
import { HINT_LINE, appeared, click, engine, lines, message, mount, picture, says, serve, sessions, silence, started, toggle, turnEnd, turnStart, typeIntoPrompt, volley } from './kit'
import type { Band, Kit } from './kit'

// The turn lifecycle (PLAN.md 6.9, D4 to D6): the court opens by itself a few seconds into a main
// turn, and when the turn ends it lets a rally in play run out and closes. The hooks module's
// timers run on the mock clock, the court's frames on the band's own.

async function clients(band: Band): Promise<number> {
  return (await band.findAll({ type: 'Client' })).length
}

/** Frames in steps of 50 ms until the band drops the court, for at most `ms`; how long it took. */
async function closes(band: Band, ms: number): Promise<number> {
  let t = 0
  while (t < ms && (await clients(band)) > 0) {
    await band.advance(50)
    t += 50
  }

  return t
}

/**
 * Moves the hooks module's clock on as a session lives through it: the helper keeps its heartbeat
 * and the court posts, so the helper runs on, stays trusted and play goes on.
 */
async function live(k: Kit, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 500) {
    k.stub.say('H 9\n')
    await k.clock.advance(500)
    await k.band.advance(32)
  }
}

/** A click, the countdown, and the rally runs with the ball hovering over your blob. */
async function play(k: Kit): Promise<void> {
  await click(k.band)
  await k.band.advance(1600)
}

test('lifecycle: the court opens by itself after the delay of a turn, paused, and the prompt keeps typing', async ($, on) => {
  const { clock, stub, store } = engine(on)
  const band = await mount($)
  await turnStart($)

  await clock.advance(4900)
  expect(await clients(band)).toBe(0)
  await clock.advance(200)
  expect(await clients(band)).toBe(1)

  await band.resize({ columns: 110, rows: 26 })
  await started({ $, band, clock, stub, store })
  const text = await lines(band)
  expect(await message(band)).toBe('Click to play')
  await typeIntoPrompt($)
  await band.advance(500)
  expect(await lines(band)).toEqual(text)
})

test('lifecycle: no court for a turn shorter than the delay', async ($, on) => {
  const { clock } = engine(on)
  const band = await mount($)
  await turnStart($)
  await clock.advance(3000)
  await turnEnd($)

  await clock.advance(10000)
  expect(await clients(band)).toBe(0)
})

test('lifecycle: after a short turn the next one waits its own delay', async ($, on) => {
  const { clock } = engine(on)
  const band = await mount($)
  await turnStart($, 't1')
  await clock.advance(3000)
  await turnEnd($, 't1')
  await clock.advance(1000)
  await turnStart($, 't2')

  // The first turn's delay runs out a second into the second turn and opens nothing.
  await clock.advance(4900)
  expect(await clients(band)).toBe(0)
  await clock.advance(200)
  expect(await clients(band)).toBe(1)
})

test('lifecycle: switched off in /config the court does not open by itself; /volley still shows it', { options: { enabled: false } }, async ($, on) => {
  const { clock } = engine(on)
  const band = await mount($)
  await turnStart($)
  await clock.advance(10000)
  expect(await clients(band)).toBe(0)

  expect(await toggle($)).toBe('Wobbly Volley: court shown')
  expect(await clients(band)).toBe(1)
})

test('lifecycle: delaySeconds sets when the court opens', { options: { delaySeconds: 2 } }, async ($, on) => {
  const { clock } = engine(on)
  const band = await mount($)
  await turnStart($)

  await clock.advance(1900)
  expect(await clients(band)).toBe(0)
  await clock.advance(200)
  expect(await clients(band)).toBe(1)
})

test('lifecycle: /volley off hides a court that opened by itself, and none opens by itself again', async ($, on) => {
  const k = await appeared($, on)
  await volley($, 'off')
  expect(await clients(k.band)).toBe(0)

  await turnEnd($)
  await turnStart($, 't2')
  await k.clock.advance(10000)
  expect(await clients(k.band)).toBe(0)
})

test('lifecycle: /volley on ends the mute with a court that stays past the turn end; hidden, the next turn opens it by itself', async ($, on) => {
  const { clock } = engine(on)
  const band = await mount($)
  await volley($, 'off')
  await turnStart($, 't1')
  await clock.advance(6000)
  expect(await clients(band)).toBe(0)

  await volley($, 'on')
  expect(await clients(band)).toBe(1)
  await turnEnd($, 't1')
  await clock.advance(12000)
  expect(await clients(band)).toBe(1)

  await toggle($)
  await turnStart($, 't2')
  await clock.advance(5100)
  expect(await clients(band)).toBe(1)
})

test('lifecycle: while muted the bare toggle still shows a court, and the mute stays', async ($, on) => {
  const { clock } = engine(on)
  const band = await mount($)
  await volley($, 'off')
  expect(await toggle($)).toBe('Wobbly Volley: court shown')
  expect(await clients(band)).toBe(1)

  await toggle($)
  await turnStart($)
  await clock.advance(10000)
  expect(await clients(band)).toBe(0)
})

test('lifecycle: a turn end closes a court waiting for its first click at once', async ($, on) => {
  const k = await appeared($, on)
  await turnEnd($)

  expect(await closes(k.band, 1000)).toBeLessThanOrEqual(100)
})

test('lifecycle: at the turn end the rally plays out under the marker, then the court closes', async ($, on) => {
  const k = await appeared($, on)
  await serve(k)
  await k.band.advance(300)

  await turnEnd($)
  await k.band.advance(50)
  expect((await lines(k.band))[HINT_LINE]).toContain('Claude is done: this rally plays out, then the court closes.')
  const before = await picture(k.band)
  await k.band.advance(200)
  expect(await picture(k.band)).not.toEqual(before)

  // A point ends it, or the cut after 10 s of play.
  expect(await closes(k.band, 12000)).toBeLessThanOrEqual(10500)
})

test("lifecycle: a subagent's turn end changes nothing", async ($, on) => {
  const k = await appeared($, on)
  await play(k)

  await turnEnd($, 'sub', 'agent-1')
  await k.band.advance(1000)
  expect(await clients(k.band)).toBe(1)
  expect((await lines(k.band))[HINT_LINE]).not.toContain('Claude is done')
  expect(await message(k.band)).toBe('')
})

test('lifecycle: a court that does not post at the turn end, collapsed or behind a dialog, closes at once', async ($, on) => {
  const k = await appeared($, on)
  await k.band.unmount()
  await k.clock.advance(1100)

  await turnEnd($)
  expect(await clients(await mount($))).toBe(0)
})

/** A rally runs, the turn ends, and the court stops posting: it is collapsed during the cut. */
async function silentAfterTurnEnd($: Engine, on: On): Promise<Kit> {
  const k = await appeared($, on)
  await play(k)
  await turnEnd($)
  await k.band.unmount()

  return k
}

// A drawn court would end the wait itself, so /volley tells whether the band still holds one.
test('lifecycle: a court silent after the turn end still stands at 10.9 s', { timeoutMs: 30000 }, async ($, on) => {
  const k = await silentAfterTurnEnd($, on)
  await k.clock.advance(10900)
  expect(await toggle($)).toBe('Wobbly Volley: court hidden')
})

test('lifecycle: a court silent after the turn end is closed at 11 s', { timeoutMs: 30000 }, async ($, on) => {
  const k = await silentAfterTurnEnd($, on)
  await k.clock.advance(11100)
  expect(await toggle($)).toBe('Wobbly Volley: court shown')
})

test('lifecycle: a court /volley opened stays after the turn end and plays on', { timeoutMs: 30000 }, async ($, on) => {
  const { clock, stub, store } = engine(on)
  await turnStart($)
  await toggle($)
  const band = await mount($)
  await band.resize({ columns: 110, rows: 26 })
  const k: Kit = { $, band, clock, stub, store }
  await started(k)
  await play(k)

  // The turn's delay runs out with the court already shown, and leaves it the court /volley opened.
  await live(k, 5500)
  await turnEnd($)
  await band.advance(1000)
  expect((await lines(band))[HINT_LINE]).not.toContain('Claude is done')
  expect(await message(band)).toBe('')

  // No close comes later either.
  await live(k, 11500)
  expect(await clients(band)).toBe(1)
  expect(await message(band)).toBe('')
})

test('lifecycle: a court /volley opens while the rally runs out stays', { timeoutMs: 30000 }, async ($, on) => {
  const k = await appeared($, on)
  await serve(k)
  await k.band.advance(300)
  await turnEnd($)
  await k.band.advance(50)

  expect(await toggle($)).toBe('Wobbly Volley: court hidden')
  await k.band.unmount()
  expect(await toggle($)).toBe('Wobbly Volley: court shown')
  const band = await mount($)
  await band.resize({ columns: 110, rows: 26 })
  const again: Kit = { ...k, band }
  await band.advance(500)
  expect(await clients(band)).toBe(1)

  // Past the wait for the closed court's rally, too.
  await live(again, 11500)
  expect(await clients(band)).toBe(1)
})

test('lifecycle: a turn that starts while the rally runs out keeps the court; its end closes it', { timeoutMs: 30000 }, async ($, on) => {
  const k = await appeared($, on)
  await serve(k)
  await k.band.advance(300)
  await turnEnd($, 't1')
  await k.band.advance(50)
  expect((await lines(k.band))[HINT_LINE]).toContain('Claude is done')

  // A prompt typed ahead starts the next turn at once.
  await turnStart($, 't2')
  await k.band.advance(11000)
  expect(await clients(k.band)).toBe(1)
  expect(await message(k.band)).toContain('Paused, click to resume')
  // The wait of the first turn end is over for good: 11 s later the court still stands.
  await live(k, 11500)
  expect(await clients(k.band)).toBe(1)

  await turnEnd($, 't2')
  expect(await closes(k.band, 1000)).toBeLessThanOrEqual(100)
})

// A turn that saved a file in the plugin's folder reloads the module as it ends (PLAN.md 5.1 row 27).
// The kit runs the load's hooks again on the same module (row 75): the fresh load's wait for a court
// it has not heard from yet is left to the user's check.
test('lifecycle: a reload while the rally runs out lets it run out, then the court closes', async ($, on) => {
  const reload = sessions(on)
  const k = await appeared($, on)
  await serve(k)
  await k.band.advance(300)
  await turnEnd($)
  await k.band.advance(50)

  await reload($)
  await k.band.advance(50)
  expect(await clients(k.band)).toBe(1)
  expect((await lines(k.band))[HINT_LINE]).toContain('Claude is done')
  expect(await closes(k.band, 12000)).toBeLessThanOrEqual(10500)
})

test('lifecycle: the rally after a turn end waits for a helper not trusted, then plays out', { timeoutMs: 30000 }, async ($, on) => {
  const k = await appeared($, on)
  await serve(k)
  await k.band.advance(300)
  await turnEnd($)
  await k.band.advance(50)

  await silence(k)
  const held = await picture(k.band)
  await k.band.advance(500)
  expect(await picture(k.band)).toEqual(held)
  expect(await clients(k.band)).toBe(1)
  expect(await message(k.band)).not.toContain('Paused')

  await says(k, 'H 9\n')
  expect((await lines(k.band))[HINT_LINE]).toContain('Claude is done')
  expect(await closes(k.band, 12000)).toBeLessThanOrEqual(10500)
})

test('lifecycle: a reload during a turn opens the court when the delay of the turn runs out', async ($, on) => {
  const reload = sessions(on)
  const { clock } = engine(on)
  const band = await mount($)
  await turnStart($)
  await clock.advance(2000)

  await reload($)
  await clock.advance(2900)
  expect(await clients(band)).toBe(0)
  await clock.advance(200)
  expect(await clients(band)).toBe(1)
})

test('lifecycle: the settings, read from what /config hands the module', () => {
  expect(readSettings({})).toEqual({ enabled: true, delayMs: 5000, level: 'medium' })
  expect(readSettings({ enabled: false, delaySeconds: 2, difficulty: 'hard' })).toEqual({ enabled: false, delayMs: 2000, level: 'hard' })
  expect(readSettings({ difficulty: 'easy' })).toEqual({ enabled: true, delayMs: 5000, level: 'easy' })
  expect(readSettings({ delaySeconds: 2.5 })).toEqual({ enabled: true, delayMs: 2500, level: 'medium' })
  expect(readSettings({ delaySeconds: -1 })).toEqual({ enabled: true, delayMs: 0, level: 'medium' })
  expect(readSettings({ delaySeconds: 99 })).toEqual({ enabled: true, delayMs: 60000, level: 'medium' })
  const odds = [{ enabled: 'no' }, { delaySeconds: '3' }, { delaySeconds: Number.NaN }, { delaySeconds: Number.POSITIVE_INFINITY }, { difficulty: 'expert' }, { difficulty: 3 }]
  for (const odd of odds) expect(readSettings(odd)).toEqual({ enabled: true, delayMs: 5000, level: 'medium' })
})

test('lifecycle: what a fresh load does with the band and the turn it finds', () => {
  const on: Settings = { enabled: true, delayMs: 5000, level: 'medium' }
  const off: Settings = { enabled: false, delayMs: 5000, level: 'medium' }
  const running: VolleyTurn = { id: 't1', startedAt: 1000, working: true, doneSeq: 2 }
  const ended: VolleyTurn = { ...running, working: false }
  const hidden: VolleyBand = { mode: 'hidden', muted: false, manual: false }
  const auto: VolleyBand = { ...hidden, mode: 'court' }
  const manual: VolleyBand = { ...auto, manual: true }
  const at = (turn: VolleyTurn | undefined, band: VolleyBand, settings = on, now = 3000) => afterLoad({ turn, band, settings, now })

  // A court that opened by itself lets its rally run out once its turn ended, and closes once the
  // setting went off.
  expect(at(ended, auto)).toEqual({ kind: 'finish' })
  expect(at(ended, auto, off)).toEqual({ kind: 'close' })
  expect(at(undefined, auto)).toEqual({ kind: 'close' })
  expect(at(running, auto, off)).toEqual({ kind: 'close' })
  expect(at(running, auto)).toEqual({ kind: 'none' })
  // A court /volley opened stays.
  expect(at(ended, manual)).toEqual({ kind: 'none' })
  expect(at(running, manual, off)).toEqual({ kind: 'none' })
  // A turn still running waits out what is left of its delay.
  expect(at(running, hidden)).toEqual({ kind: 'arm', ms: 3000 })
  expect(at(running, hidden, on, 9000)).toEqual({ kind: 'arm', ms: 0 })
  expect(at(running, hidden, off)).toEqual({ kind: 'none' })
  expect(at(running, { ...hidden, muted: true })).toEqual({ kind: 'none' })
  expect(at(ended, hidden)).toEqual({ kind: 'none' })
  expect(at(undefined, hidden)).toEqual({ kind: 'none' })
})
