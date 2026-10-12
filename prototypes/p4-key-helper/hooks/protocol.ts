// What court.tsx (drawing thread) and register.tsx (hooks worker) send each other.

/** The helper's latest key state (PLAN.md 6.10 `keys`), with the helper's time stamp of the change. */
export type KeyState = { ok: boolean; seq: number; mask: number; at: number }

/** Hooks module to Client, as props: for which instance, the last event received from it, the key state, lines to show. */
export type P4Props = { v: 1; instance: string; ack: number; keys: KeyState; lines: string[] }

/** One thing the Client saw, numbered so the hooks module can acknowledge it. */
export type ClientEvent =
  | { n: number; kind: 'mask'; seq: number; at: number }
  | { n: number; kind: 'key'; key: string; at: number }

/** Client to hooks module, one post per tick: every event not yet acknowledged. */
export type P4Post = { v: 1; instance: string; events: ClientEvent[] }

/** The mask bits of PLAN.md 6.10. */
export const LEFT = 1
export const RIGHT = 2
export const JUMP = 4
export const ESC = 8
export const FRONT = 16
