// What court.tsx (drawing thread) and register.tsx (hooks worker) send each other.

/** Hooks module to Client, as props. */
export type CourtProps = {
  v: 1
  tickMs: number
  working: boolean
  /** The last CPU sample, as one line for the stats row. */
  cpu: string
}

/** One second of drawing, as the Client measured it. */
export type CourtWindow = {
  ms: number
  ticks: number
  renders: number
  maxGap: number
  p95Gap: number
  renderMean: number
  renderMax: number
  chars: number
  nodes: number
  columns: number
  rows: number
  tickMs: number
  working: boolean
}

/** Client to hooks module, once a second. */
export type CourtReport = { v: 1; instance: string; window: CourtWindow }
