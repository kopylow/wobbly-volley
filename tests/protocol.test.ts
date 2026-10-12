import { expect, test } from 'claude-code/testing'

import { readMatch, readRecord, readReport } from '../hooks/protocol'
import type { CourtReport } from '../hooks/protocol'
import type { VolleyRecord } from '../types'

// The report is the one thing the hooks module takes from the drawing thread (PLAN.md 6.10): it is
// read field by field, and anything else a post could carry is dropped.

const REPORT: CourtReport = {
  v: 1,
  frame: 120,
  phase: 'matchEnd',
  match: { v: 1, you: 0, claude: 0, server: 'you', number: 2 },
  lastMatch: { winner: 'claude', you: 7, claude: 11 },
  closed: 3,
}

test('protocol: a report the court posts reads back as it was', () => {
  expect(readReport(REPORT)).toEqual(REPORT)
  expect(readReport(structuredClone({ ...REPORT, lastMatch: null, phase: 'rally' }))).toEqual({ ...REPORT, lastMatch: null, phase: 'rally' })
  // Fields a later version may add are not carried along.
  expect(readReport({ ...REPORT, extra: 1 })).toEqual(REPORT)
})

test('protocol: anything else is dropped', () => {
  const broken: unknown[] = [
    null,
    'report',
    [REPORT],
    { ...REPORT, v: 2 },
    { ...REPORT, frame: -1 },
    { ...REPORT, phase: 'warmup' },
    { ...REPORT, frame: 1.5 },
    { ...REPORT, match: { ...REPORT.match, you: 1.5 } },
    { ...REPORT, match: { ...REPORT.match, server: 'nobody' } },
    { ...REPORT, match: { ...REPORT.match, number: 0 } },
    { ...REPORT, match: undefined },
    { ...REPORT, lastMatch: { winner: 'claude', you: 7 } },
    { ...REPORT, lastMatch: undefined },
    { ...REPORT, closed: -1 },
    { ...REPORT, closed: 1.5 },
    { ...REPORT, closed: undefined },
  ]
  for (const data of broken) expect(readReport(data)).toBeNull()
})

// The store's values are read the same way (PLAN.md 6.11): another version or shape reads as none.

const RECORD: VolleyRecord = { v: 1, won: 2, lost: 1, pointsFor: 45, pointsAgainst: 38 }

test('protocol: a saved standing and record read back as they were, anything else as none', () => {
  expect(readMatch(REPORT.match)).toEqual(REPORT.match)
  expect(readRecord(structuredClone({ ...RECORD, extra: 1 }))).toEqual(RECORD)

  const broken: unknown[] = [
    undefined,
    null,
    'record',
    [RECORD],
    { ...RECORD, v: 2 },
    { ...RECORD, won: -1 },
    { ...RECORD, lost: 1.5 },
    { ...RECORD, pointsFor: '45' },
    { ...RECORD, pointsAgainst: undefined },
  ]
  for (const value of broken) expect(readRecord(value)).toBeNull()
  expect(readMatch(undefined)).toBeNull()
  expect(readMatch({ ...REPORT.match, v: 2 })).toBeNull()
})
