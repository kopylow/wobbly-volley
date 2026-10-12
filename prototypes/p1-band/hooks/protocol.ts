// What probe.tsx (drawing thread) and register.tsx (hooks worker) send each other.

export type Field = string | number | boolean | null

/** One thing the Client saw, numbered so the hooks module can acknowledge it. */
export type ProbeEvent = {
  n: number
  perf: number
  date: number
  kind: string
  [field: string]: Field
}

/** Client to hooks module, one post per tick: every event not yet acknowledged. */
export type ProbePost = { v: 1; instance: string; seq: number; events: ProbeEvent[] }

/** Hooks module to Client, as props: for which instance, the last event received from it, the post this answers, lines to show. */
export type ProbeProps = { v: 1; instance: string; ack: number; echo: number; lines: string[] }
