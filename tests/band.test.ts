import { expect, test } from 'claude-code/testing'

import { DONE, hint } from '../hooks/court'
import type { Phase } from '../core/types'
import { HINT_LINE, PROPS, VIEWPORT, blue, centre, click, court, engine, hold, lines, message, mount, picture, reopen, serve, started, toggle, typeIntoPrompt, untilPoint, weight } from './kit'
import type { Band, Kit } from './kit'

// The band and the court's Client in the kit (PLAN.md section 8), played with WASD through the
// stand-in key helper of tests/kit.ts. The kit draws a Client at the viewport's size until resized,
// so each test lays the court out as the band would.

test('band: hidden until /volley, then the court waiting for its helper and a click', async ($, on) => {
  const { clock, stub, store } = engine(on)
  const band = await mount($)
  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)

  expect(await toggle($)).toBe('Wobbly Volley: court shown')
  expect((await band.find({ type: 'Client' }))?.props).toMatchObject({ key: 'court', width: 110, height: 26 })
  await band.resize({ columns: 110, rows: 26 })
  expect((await lines(band))[HINT_LINE]).toContain('Waiting for the key helper')

  await started({ $, band, clock, stub, store })
  const text = await lines(band)
  expect(text).toHaveLength(26)
  expect(text[0]).toBe('You 0 : 0 Jelly   medium   matches won 0, lost 0')
  for (const row of text.slice(1, 25)) expect(row).toHaveLength(110)
  expect(await message(band)).toBe('Click to play')
  expect(text[HINT_LINE]).toContain('Click to play. A and D run, W jumps; hold W to jump higher.')

  // Nothing moves before the click, and typing into the prompt changes nothing.
  await band.advance(2000)
  await typeIntoPrompt($)
  await band.advance(500)
  expect(await lines(band)).toEqual(text)
})

test('band: the AI level of /config plays in the court, its name on the score row and in its point', { options: { difficulty: 'hard' } }, async ($, on) => {
  const k = await court($, on)
  expect((await lines(k.band))[0]).toBe('You 0 : 0 Gummy   hard   matches won 0, lost 0')

  // Your serve and nothing after it: the point is the AI's.
  await serve(k)
  expect(await untilPoint(k)).toBeLessThan(60)
  expect((await lines(k.band))[0]).toBe('You 0 : 1 Gummy   hard   matches won 0, lost 0')
  expect(await message(k.band)).toBe('Point for Gummy')
})

test('band: where no key helper runs there is no game, only a line that says why', async ($, on) => {
  engine(on, { os: '' })
  await toggle($)
  const band = await mount($)

  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
  expect(await band.find({ type: 'Text', text: /needs its key helper to read held keys, and there is none for this system yet/ })).toBeDefined()
})

test('band: sized from the band, one line when the court does not fit', async ($, on) => {
  engine(on)
  await toggle($)

  const sizes = [
    [{ bodyColumns: 200 }, 160, 26],
    [{ maxRows: 20 }, 110, 20],
    [{ bodyColumns: 60, maxRows: 18 }, 60, 18],
  ] as const
  for (const [props, width, height] of sizes) {
    const band = await mount($, props)
    expect((await band.find({ type: 'Client' }))?.props).toMatchObject({ width, height })
    await band.unmount()
  }

  // Too little room keeps the Client, one row high, and it shows the line.
  for (const [props, width, need] of [
    [{ maxRows: 17 }, 110, 'taller'],
    [{ bodyColumns: 59 }, 59, 'wider'],
  ] as const) {
    const band = await mount($, props)
    expect((await band.find({ type: 'Client' }))?.props).toMatchObject({ width, height: 1 })
    await band.resize({ columns: width, rows: 1 })
    expect(await lines(band)).toEqual([`Wobbly Volley needs a ${need} window`])
    await band.unmount()
  }
})

test('band: a click counts down three beats, each digit lighting up and fading, then the rally runs', async ($, on) => {
  const { band } = await court($, on)
  await click(band)

  for (const digit of ['3', '2', '1']) {
    expect(await message(band)).toBe(digit)
    // Over its beat the digit is drawn bold, then plain, then dim.
    const seen: string[] = []
    for (let t = 0; t < 500; t += 50) {
      if ((await message(band)) === digit) {
        const now = String(await weight(band))
        if (now !== seen[seen.length - 1]) seen.push(now)
      }
      await band.advance(50)
    }
    expect(seen).toEqual(['bold', 'plain', 'dim'])
  }
  expect(await message(band)).toBe('')
  expect(await weight(band)).toBe(null)
  expect((await lines(band))[HINT_LINE]).toContain('A and D run, W jumps. Esc once hands the keys to the prompt.')
})

test('band: every hint and the turn end marker fit the narrowest court', () => {
  const phases: Phase[] = ['idle', 'countdown', 'rally', 'point', 'matchEnd', 'paused']
  for (const phase of phases) for (const helper of [true, false]) expect(hint(phase, helper).length).toBeLessThanOrEqual(60)
  expect(DONE.length).toBeLessThanOrEqual(60)
})

test('band: held keys steer: A and D run while held, W jumps, a longer hold higher', async ($, on) => {
  const k = await court($, on)
  await click(k.band)
  await k.band.advance(1600)

  const home = await blue(k.band)
  // Your blob is 7 columns wide around its centre column.
  expect(home.right - home.left).toBe(6)
  await hold(k, 'a', 300)
  const left = await centre(k.band)
  expect(left).toBeLessThan((home.left + home.right) / 2 - 8)
  await k.band.advance(500)
  expect(await centre(k.band)).toBe(left)
  await hold(k, 'd', 200)
  expect(await centre(k.band)).toBeGreaterThan(left + 5)

  // A short and a long hold of W: the top row each jump reaches, and the landing. The walk's wobble
  // runs out first, so the blob stands at rest.
  await k.band.advance(500)
  const ground = await blue(k.band)
  const jump = async (ms: number): Promise<number> => {
    await hold(k, 'w', ms)
    let top = (await blue(k.band)).top
    for (let i = 0; i < 20; i++) {
      await k.band.advance(32)
      top = Math.min(top, (await blue(k.band)).top)
    }
    expect(await blue(k.band)).toEqual(ground)
    return top
  }
  const low = await jump(30)
  const high = await jump(400)
  expect(low).toBeLessThan(ground.top - 5)
  expect(high).toBeLessThan(low)
})

test('band: your serve starts a rally that ends in a point on the score row', async ($, on) => {
  const k = await court($, on)
  await serve(k)

  expect(await untilPoint(k)).toBeLessThan(60)
  expect(await message(k.band)).toMatch(/Point for (you|Jelly)/)
})

test('band: a whole match ends on the win screen, the record counts it, a click starts the next', { timeoutMs: 60000 }, async ($, on) => {
  const k = await court($, on)
  await serve(k)

  // Jump now and then, which serves whenever the ball waits above you; otherwise your blob stands.
  let seconds = 0
  let end = ''
  for (; seconds < 600 && end === ''; seconds++) {
    await k.band.advance(1000)
    end = /(You win|Jelly wins) \d+ : \d+/.exec(await message(k.band))?.[0] ?? ''
    if (end === '' && seconds % 3 === 2) await hold(k, 'w', 250)
  }
  expect(end).not.toBe('')

  const [, you = 0, claude = 0] = (/(\d+) : (\d+)/.exec(end) ?? []).map(Number)
  expect(Math.max(you, claude)).toBeGreaterThanOrEqual(11)
  expect(Math.abs(you - claude)).toBeGreaterThanOrEqual(2)
  const won = end.startsWith('You') ? 1 : 0
  const score = `You 0 : 0 Jelly   medium   matches won ${won}, lost ${1 - won}`
  expect((await lines(k.band))[0]).toBe(score)
  expect((await lines(k.band))[HINT_LINE]).toContain('Click for the next match')

  // A click on the win screen starts the next match's countdown at once (PLAN.md 3.2).
  await click(k.band)
  expect(await message(k.band)).toBe('3')

  // The court closing and coming back keeps the standing and the record.
  const again = await reopen(k)
  expect((await lines(again.band))[0]).toBe(score)
  expect(await message(again.band)).toContain('Click to play')
})

test('band: typing into the prompt pauses the rally, a click resumes it where it stopped', async ($, on) => {
  const k = await court($, on)
  await serve(k)
  await k.band.advance(300)

  await typeIntoPrompt($)
  await k.band.advance(50)
  const frozen = await picture(k.band)
  expect(await message(k.band)).toContain('Paused, click to resume')
  expect((await lines(k.band))[HINT_LINE]).toContain('Click to resume')
  await k.band.advance(2000)
  expect(await picture(k.band)).toEqual(frozen)

  // The click counts down with everything frozen, then the rally goes on.
  await click(k.band)
  await k.band.advance(1300)
  expect(await picture(k.band)).toEqual(frozen)
  await k.band.advance(400)
  expect(await picture(k.band)).not.toEqual(frozen)
})

test('band: a frame clock at the background rate pauses play once; a click resumes it for good', async ($, on) => {
  // Every tick counts as 32.5 ms of play, as the frame clock runs while the window is in the back.
  // The helper starts within the first ticks, before the slow clock counts as gone.
  const k = await court($, on, { clock: 'away' })
  expect(await message(k.band)).toContain('Click to play')

  // The window counts as gone once 12 of the last 16 ticks were slow, here a quarter second after
  // the click: the countdown pauses then.
  await click(k.band)
  expect(await message(k.band)).toBe('3')
  await k.band.advance(400)
  expect(await message(k.band)).toContain('Paused, click to resume')

  // The click that brings the window back resumes; the slow clock is old news and pauses no more.
  await click(k.band)
  await k.band.advance(2000)
  expect(await message(k.band)).toBe('')
  expect((await lines(k.band))[HINT_LINE]).toContain('Esc once hands the keys to the prompt')
})

test('band: without room the game pauses and holds its width; a click resumes it', async ($, on) => {
  const k = await court($, on)
  await serve(k)
  await k.band.advance(300)
  const before = await picture(k.band)

  for (const [columns, rows] of [
    [110, 1],
    [50, 26],
  ] as const) {
    await k.band.resize({ columns, rows })
    await k.band.advance(2000)
    await k.band.resize({ columns: 110, rows: 26 })
    expect(await picture(k.band)).toEqual(before)
    expect(await message(k.band)).toContain('Paused, click to resume')
  }

  await click(k.band)
  await k.band.advance(2000)
  expect(await picture(k.band)).not.toEqual(before)
})

test('band: the standing comes back when the court closes and opens again', async ($, on) => {
  const k = await court($, on)
  await serve(k)
  expect(await untilPoint(k)).toBeLessThan(60)
  await k.band.advance(1500)
  const standing = (await lines(k.band))[0]

  // A fresh court with the standing, waiting for a click; the rally is served again.
  const again = await reopen(k)
  expect((await lines(again.band))[0]).toBe(standing)
  expect(await message(again.band)).toContain('Click to play')
})

test('band: a resize during a rally serves again after a countdown', async ($, on) => {
  const k = await court($, on)
  await serve(k)
  await k.band.advance(300)

  await k.band.resize({ columns: 80, rows: 26 })
  const narrow = await lines(k.band)
  expect(narrow).toHaveLength(26)
  for (const row of narrow.slice(1, 25)) expect(row).toHaveLength(80)
  expect(await message(k.band)).toBe('3')

  await k.band.resize({ columns: 160, rows: 20 })
  const short = await lines(k.band)
  expect(short).toHaveLength(20)
  for (const row of short.slice(1, 19)) expect(row).toHaveLength(160)
})

test('band: the desktop and a survey keep the band to the engine', async ($, on) => {
  engine(on)
  await toggle($)

  const desktop = await $.ui.mount({ plugin: 'wobbly-volley', surface: 'desktop', component: 'AbovePrompt', props: PROPS, viewport: VIEWPORT })
  expect(await desktop.drawn()).toEqual({ type: 'Box' })

  const survey = await mount($, { hasSurvey: true })
  expect(await survey.drawn()).toEqual({ type: 'Box' })
})

test('band: a second /volley takes the court away', async ($, on) => {
  engine(on)
  await toggle($)
  const band = await mount($)
  expect(await band.findAll({ type: 'Client' })).toHaveLength(1)

  expect(await toggle($)).toBe('Wobbly Volley: court hidden')
  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
})

test('band: every court that opens draws a new seed', async ($, on) => {
  const seed = async (band: Band) => ((await band.find({ type: 'Client' }))?.props.props as { seed?: number } | undefined)?.seed
  const k = await court($, on)
  const first = await seed(k.band)
  expect(first).toBeGreaterThan(0)

  await k.clock.advance(1000)
  const again = await reopen(k)
  expect(await seed(again.band)).toBeGreaterThan(first ?? 0)
})

test('band: the court tree stays far below the Client bound in play', async ($, on) => {
  const { clock, stub, store } = engine(on)
  await toggle($)
  const band = await mount($, { bodyColumns: 160 })
  await band.resize({ columns: 160, rows: 26 })
  const k: Kit = { $, band, clock, stub, store }
  await started(k)
  await serve(k)

  let largest = 0
  for (let i = 0; i < 20; i++) {
    await band.advance(250)
    largest = Math.max(largest, JSON.stringify(await band.drawn({ in: 'court' })).length)
  }
  expect(largest).toBeLessThan(20000)
})
