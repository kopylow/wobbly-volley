import { expect, test } from 'claude-code/testing'

import { ESC, FRONT, HINT_LINE, KEYS, WSL_SCRIPT, centre, click, court, engine, lines, message, mount, picture, says, serve, silence, started, toggle } from './kit'
import type { Kit } from './kit'

// The key helper in the kit (PLAN.md 6.8, 6.12), through the stand-in of tests/kit.ts: when it
// starts and stops, how its keys reach the court, and when play pauses because the keys left.

/** A click into the court and its countdown: the rally runs. */
async function play(band: Parameters<typeof click>[0]): Promise<void> {
  await click(band)
  await band.advance(1500)
}

test('helper: the court posting starts the Windows helper, and held keys move your blob', async ($, on) => {
  const k = await court($, on)
  expect(k.stub.argv).toHaveLength(1)
  expect(k.stub.argv[0]?.slice(0, 6)).toEqual(['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File'])
  expect(k.stub.argv[0]?.[6]).toMatch(/[\\/]helper[\\/]keys\.ps1$/)
  expect((await lines(k.band))[HINT_LINE]).toContain('A and D run, W jumps; hold W to jump higher.')

  // D held, its press reaching the court: the blob runs right while it is down and stops on release.
  await play(k.band)
  const home = await centre(k.band)
  await says(k, `K ${KEYS.d! | FRONT} 2\n`)
  await k.band.key({ key: 'd' })
  await k.band.advance(400)
  expect(await centre(k.band)).toBeGreaterThan(home + 10)
  await says(k, `K ${FRONT} 3\n`)
  const stopped = await centre(k.band)
  await k.band.advance(500)
  expect(await centre(k.band)).toBe(stopped)
  expect(await message(k.band)).toBe('')
})

test('helper: in WSL the court starts the Windows helper by the path wslpath gives, and held keys move your blob', async ($, on) => {
  const { clock, stub, store, wslpath } = engine(on, { os: '', distro: 'Ubuntu-24.04' })
  await toggle($)
  const band = await mount($)
  await band.resize({ columns: 110, rows: 26 })
  const k: Kit = { $, band, clock, stub, store }
  await started(k)

  expect(wslpath.asked).toHaveLength(1)
  expect(wslpath.asked[0]?.slice(0, 2)).toEqual(['wslpath', '-w'])
  expect(wslpath.asked[0]?.[2]).toMatch(/[\\/]helper[\\/]keys\.ps1$/)
  expect(stub.argv).toEqual([['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', WSL_SCRIPT]])
  expect((await lines(band))[HINT_LINE]).toContain('A and D run, W jumps; hold W to jump higher.')

  await play(band)
  const home = await centre(band)
  await says(k, `K ${KEYS.d! | FRONT} 2\n`)
  await band.key({ key: 'd' })
  await band.advance(400)
  expect(await centre(band)).toBeGreaterThan(home + 10)
})

test('helper: in WSL where wslpath fails, whatever it wrote, the band says the helper could not start', async ($, on) => {
  const { stub, wslpath } = engine(on, { os: '', distro: 'Ubuntu-24.04' })
  wslpath.exitCode = 1
  await toggle($)
  const band = await mount($)

  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
  expect(await band.find({ type: 'Text', text: /needs its key helper to read held keys, and it could not start/ })).toBeDefined()
  expect(stub.argv).toHaveLength(0)
})

test('helper: in WSL where wslpath answers with no path the band says the same', async ($, on) => {
  const { stub, wslpath } = engine(on, { os: '', distro: 'Ubuntu-24.04' })
  wslpath.stdout = '\n'
  await toggle($)
  const band = await mount($)

  expect(await band.findAll({ type: 'Client' })).toHaveLength(0)
  expect(await band.find({ type: 'Text', text: /needs its key helper to read held keys, and it could not start/ })).toBeDefined()
  expect(stub.argv).toHaveLength(0)
})

test('helper: a key down that never reaches the court as a press pauses within 150 ms', async ($, on) => {
  const k = await court($, on)
  await play(k.band)

  // The keys go somewhere else: the prompt, another tab of the terminal. Space is no press of A.
  await says(k, `K ${KEYS.a! | FRONT} 2\n`)
  await k.band.key({ key: 'space' })
  await k.band.advance(100)
  expect(await message(k.band)).toBe('')
  await k.band.advance(100)
  expect(await message(k.band)).toContain('Paused, click to resume')
})

test('helper: Esc going down and the terminal leaving the front both pause play', async ($, on) => {
  const k = await court($, on)

  await play(k.band)
  await says(k, `K ${ESC | FRONT} 2\n`)
  expect(await message(k.band)).toContain('Paused, click to resume')

  await says(k, `K ${FRONT} 3\n`)
  await play(k.band)
  expect(await message(k.band)).toBe('')
  await says(k, 'K 0 4\n')
  expect(await message(k.band)).toContain('Paused, click to resume')

  // The click that brings the window back meets props that still say it is not in front; only a
  // change counts, so play goes on until the helper reports the front again.
  await play(k.band)
  expect(await message(k.band)).toBe('')
  await says(k, `K ${FRONT} 5\n`)
  expect(await message(k.band)).toBe('')
})

test('helper: held keys move nothing in a pause, which only a click ends', async ($, on) => {
  const k = await court($, on)
  await play(k.band)
  await says(k, `K ${ESC | FRONT} 2\n`)
  await says(k, `K ${FRONT} 3\n`)

  const before = await centre(k.band)
  await says(k, `K ${KEYS.d! | FRONT} 4\n`)
  await k.band.key({ key: 'd' })
  await k.band.advance(500)
  expect(await centre(k.band)).toBe(before)
})

test('helper: it stops within a second and a half after the court stops posting, and starts again with the next post', async ($, on) => {
  const k = await court($, on)

  // The watch looks every 500 ms; the loop then leaves at the next piece, which the heartbeat brings.
  await k.band.unmount()
  await k.clock.advance(1600)
  k.stub.say('H 2\n')
  await k.clock.advance(20)
  expect(k.stub.closed).toBe(1)

  const again = await mount($)
  await again.resize({ columns: 110, rows: 26 })
  await again.advance(16)
  await k.clock.settle()
  expect(k.stub.argv).toHaveLength(2)
})

test('helper: after an E line the band says why in place of the court, and no helper starts again', async ($, on) => {
  const k = await court($, on)
  expect(await k.band.findAll({ type: 'Client' })).toHaveLength(1)

  await says(k, 'E nowindow\n')
  await k.clock.settle()
  expect(k.stub.closed).toBe(1)
  expect(await k.band.findAll({ type: 'Client' })).toHaveLength(0)
  expect(await k.band.find({ type: 'Text', text: /needs its key helper to read held keys, and it found no terminal window/ })).toBeDefined()

  await k.clock.advance(1000)
  expect(k.stub.argv).toHaveLength(1)
})

test('helper: a helper silent for two seconds is no longer trusted', async ($, on) => {
  const k = await court($, on)

  await k.clock.advance(1900)
  await k.band.advance(32)
  expect((await lines(k.band))[HINT_LINE]).toContain('A and D run, W jumps')
  await k.clock.advance(600)
  await k.band.advance(32)
  expect((await lines(k.band))[HINT_LINE]).toContain('Waiting for the key helper')
})

// A reload of the hooks module ends the helper and starts the next, ready about a second later: no
// pause for the window leaving, which the empty mask of a helper not trusted would otherwise say.
test('helper: while it is not trusted the rally holds still, and goes on by itself once it speaks again', async ($, on) => {
  const k = await court($, on)
  await serve(k)

  await silence(k)
  expect((await lines(k.band))[HINT_LINE]).toContain('Waiting for the key helper')
  const held = await picture(k.band)
  await k.band.advance(500)
  expect(await picture(k.band)).toEqual(held)
  // The ball may fly through the message line, so only the pause's words count.
  expect(await message(k.band)).not.toContain('Paused')

  await says(k, 'H 9\n')
  await k.band.advance(200)
  expect(await picture(k.band)).not.toEqual(held)
  expect(await message(k.band)).not.toContain('Paused')
})
