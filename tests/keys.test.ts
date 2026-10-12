import { expect, test } from 'claude-code/testing'

import { KeyFeed, LineReader, SILENT_MS, helperArgv, helperScript, parseLine, pickSystem, stopped } from '../hooks/keys'

// The helper's lines as the hooks module reads them (PLAN.md 6.12): pieces end anywhere, a line
// carries K, H or E, anything else is ignored, and a silent helper is not trusted.

test('keys: lines come whole from pieces that end anywhere', () => {
  const reader = new LineReader()
  expect(reader.push('H 179130')).toEqual([])
  expect(reader.push('0000000\r\nK 18 1791300000001\nK 1')).toEqual(['H 1791300000000', 'K 18 1791300000001'])
  expect(reader.push('6 1791300000002\n\n')).toEqual(['K 16 1791300000002'])
  expect(reader.push('E nowindow\nstart pid 1 extra words\n')).toEqual(['E nowindow', 'start pid 1 extra words'])
})

test('keys: each line kind, and anything else as other', () => {
  expect(parseLine('K 18 1791300000001')).toEqual({ kind: 'K', mask: 18, at: 1791300000001 })
  expect(parseLine('H 1791300000000')).toEqual({ kind: 'H', at: 1791300000000 })
  expect(parseLine('E noinput')).toEqual({ kind: 'E', word: 'noinput' })
  for (const line of ['K 18', 'K -1 5', 'K 1.5 5', 'H soon', 'E', 'start pid 1', '']) expect(parseLine(line).kind).toBe('other')
})

test('keys: K sets the mask, H keeps the helper trusted, E and silence end it with no key held', () => {
  const feed = new KeyFeed()
  expect(feed.state).toEqual({ ok: false, mask: 0 })

  // A helper's first H comes before its first K, which says where the keys and the window stand.
  feed.take(parseLine('H 1'), 1000)
  expect(feed.state).toEqual({ ok: false, mask: 0 })
  feed.take(parseLine('K 18 2'), 1100)
  expect(feed.state).toEqual({ ok: true, mask: 18 })
  feed.take(parseLine('start pid 1'), 1200)
  feed.take(parseLine('H 3'), 1500)
  expect(feed.state).toEqual({ ok: true, mask: 18 })

  feed.check(1500 + SILENT_MS)
  expect(feed.state.ok).toBe(true)
  feed.check(1501 + SILENT_MS)
  expect(feed.state).toEqual({ ok: false, mask: 0 })
  // The same helper speaking again: it writes K only on a change, so its last one still holds.
  feed.take(parseLine('H 4'), 4000)
  expect(feed.state).toEqual({ ok: true, mask: 18 })

  feed.take(parseLine('K 20 5'), 5000)
  expect(feed.state).toEqual({ ok: true, mask: 20 })
  feed.take(parseLine('E nowindow'), 5100)
  expect(feed.state).toEqual({ ok: false, mask: 0 })
  expect(feed.word).toBe('nowindow')
})

test('keys: a helper that ended leaves nothing to the next, which is trusted from its first K', () => {
  const feed = new KeyFeed()
  feed.take(parseLine('H 1'), 1000)
  feed.take(parseLine('K 18 2'), 1000)
  feed.end()
  expect(feed.state).toEqual({ ok: false, mask: 0 })

  feed.take(parseLine('H 3'), 2000)
  expect(feed.state).toEqual({ ok: false, mask: 0 })
  feed.take(parseLine('K 16 4'), 2000)
  expect(feed.state).toEqual({ ok: true, mask: 16 })
})

test('keys: why a helper that ended by itself is gone, in words the band shows', () => {
  expect(stopped('nowindow')).toBe('it found no terminal window')
  expect(stopped('noinput')).toBe('it can read no keyboard')
  expect(stopped('nodisplay')).toBe('it found no display')
  expect(stopped('odd')).toBe('it stopped (odd)')
  expect(stopped(null)).toBe('it stopped')
})

test('keys: Windows by OS, then WSL by its distribution, and nothing else yet', () => {
  expect(pickSystem('Windows_NT', undefined)).toBe('windows')
  expect(pickSystem('Windows_NT', 'Ubuntu-24.04')).toBe('windows')
  expect(pickSystem(undefined, 'Ubuntu-24.04')).toBe('wsl')
  expect(pickSystem(undefined, '')).toBe('other')
  expect(pickSystem(undefined, undefined)).toBe('other')
  expect(pickSystem('Linux', undefined)).toBe('other')
})

test('keys: Windows and WSL start the Windows helper, the two that passed P4', () => {
  expect(helperScript('C:\\projects\\ClaudeyVolley\\')).toBe('C:\\projects\\ClaudeyVolley\\helper\\keys.ps1')
  expect(helperScript('/mnt/c/projects/ClaudeyVolley')).toBe('/mnt/c/projects/ClaudeyVolley/helper/keys.ps1')

  const script = 'C:\\projects\\ClaudeyVolley\\helper\\keys.ps1'
  const argv = ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script]
  expect(helperArgv('windows', script)).toEqual(argv)
  expect(helperArgv('wsl', script)).toEqual(argv)
  expect(helperArgv('other', '/home/you/projects/ClaudeyVolley/helper/keys.ps1')).toBeNull()
})
