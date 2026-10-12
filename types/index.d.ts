export type VolleyMatch = { v: 1; you: number; claude: number; server: 'you' | 'claude'; number: number }
export type VolleyRecord = { v: 1; won: number; lost: number; pointsFor: number; pointsAgainst: number }
export type VolleyTurn = { id: string; startedAt: number; working: boolean; doneSeq: number }
export type VolleyBand = { mode: 'hidden' | 'court'; muted: boolean; manual: boolean }

declare module 'claude-code' {
  interface PluginState {
    'wobbly-volley': { match: VolleyMatch; record: VolleyRecord; turn: VolleyTurn; band: VolleyBand }
  }
}
