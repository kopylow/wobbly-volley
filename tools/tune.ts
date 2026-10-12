// The tuning sheet (PLAN.md 6.3, 6.6, M10): what the constants of core/constants.ts give in play.
// Runs in Node, outside the mod and outside `tsc -p .`:
//
//   npx -y tsx tools/tune.ts                     the constants as they are
//   npx -y tsx tools/tune.ts BALL_GRAVITY=170    one moved; several may be given
//   npx -y tsx tools/tune.ts NET_H=19 quick      a third of the points, for a first look
//
// It copies core/ into a folder under the system temp and replaces the named constants there, so
// it writes nothing into the mod's folder: a write there reloads the mod in every open session.
// About 10 s on the building machine; the numbers are the AI's, the user's play is the test.

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

type Side = 'you' | 'claude'
type Source = { next: (game: unknown, side: Side) => unknown }
type Level = { name: string; reaction: number; aimError: number; speed: number; jumpChance: number; placement: string }

const SIDES: Side[] = ['you', 'claude']
const WIDTHS = [60, 110, 160]
const SECOND = 60
const core = join(dirname(fileURLToPath(import.meta.url)), '..', 'core')

/**
 * The stand-in for the user that M9 calibrated to the user's record (PLAN.md section 11, M9): it won
 * 35 to 39% of points against medium as medium was then, as the user did.
 */
const PROXY: Level = { name: 'proxy', reaction: 15, aimError: 4, speed: 1, jumpChance: 0.7, placement: 'over' }

const round = (n: number, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits
const pct = (n: number) => `${round(100 * n)}%`
const seconds = (steps: number) => `${round(steps / SECOND)} s`

function quantile(values: number[], q: number): number {
  const sorted = [...values].sort((a, b) => a - b)

  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const quick = args.includes('quick')
  const moved = args.filter(a => a.includes('=')).map(a => a.split('=') as [string, string])

  const dir = mkdtempSync(join(tmpdir(), 'wobbly-tune-'))
  try {
    cpSync(core, join(dir, 'core'), { recursive: true })
    const file = join(dir, 'core', 'constants.ts')
    let text = readFileSync(file, 'utf8')
    for (const [name, value] of moved) {
      const line = new RegExp(`export const ${name} = [^\\n]+`)
      if (!line.test(text)) throw new Error(`core/constants.ts has no constant ${name}`)
      text = text.replace(line, `export const ${name} = ${value}`)
    }
    writeFileSync(file, text)
    await sheet(dir, moved, quick)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

async function sheet(dir: string, moved: [string, string][], quick: boolean): Promise<void> {
  const load = (name: string) => import(pathToFileURL(join(dir, 'core', `${name}.ts`)).href)
  const C = await load('constants')
  const { newSim, step } = await load('sim')
  const { newGame, newMatch, dispatch, tick } = await load('game')
  const { AiSource, EASY, MEDIUM, HARD } = await load('ai')
  const { groundPx } = await load('draw')
  const STAND = { run: 0, jump: false }

  console.log(`\n== ${moved.length === 0 ? 'the constants as they are' : moved.map(([n, v]) => `${n} = ${v}`).join(', ')} ==`)

  // The blob: a tap and a held jump, stepped through the sim.
  const jump = (hold: number) => {
    const sim = newSim(110, 'claude')
    let apex = 0
    let steps = 0
    for (; steps < 2000; steps++) {
      step(sim, { you: { run: 0, jump: steps < hold }, claude: STAND })
      apex = Math.max(apex, sim.blobs.you.y)
      if (steps > 0 && sim.blobs.you.y <= 0) break
    }

    return `${round(apex, 2)} px in ${round((steps + 1) / SECOND, 2)} s`
  }
  console.log(`blob: tap jump ${jump(1)}, held jump ${jump(1000)}, its half crossed in ${C.RUN_TIME} s`)
  console.log(`net ${C.NET_H} px, serve hovering at ${C.SERVE_Y} px, ${2 * 24 - groundPx(24)} px of air on 24 rows and ${2 * 16 - groundPx(16)} on 16`)
  for (const w of WIDTHS) {
    const v = C.hitSpeed(w)
    console.log(
      `${w} columns: hit speed ${round(v)} px/s, straight up the ball rises ${round((v * v) / (2 * C.BALL_GRAVITY))} px in ${round(v / C.BALL_GRAVITY, 2)} s, ` +
        `a 45 degree hit flies ${round(C.HIT_RANGE * w)} px; run speed ${round(C.runSpeed(w))} px/s`,
    )
  }

  type Tally = { points: Record<Side, number>; rallies: number[]; above: number; steps: number; touches: number }
  const play = (w: number, seed: number, sources: Record<Side, Source>, points: number): Tally => {
    const game = newGame({ w, match: newMatch(), seed })
    const tally: Tally = { points: { you: 0, claude: 0 }, rallies: [], above: 0, steps: 0, touches: 0 }
    let rally = 0
    let touch = ''
    dispatch(game, { kind: 'start' })
    // A point takes seconds; the limit only stops a broken AI from hanging the run.
    for (let i = 0; i < 4 * 3600 * SECOND && tally.points.you + tally.points.claude < points; i++) {
      if (game.phase === 'idle') dispatch(game, { kind: 'start' })
      const playing = game.phase === 'rally'
      const events = tick(game, { you: sources.you.next(game, 'you'), claude: sources.claude.next(game, 'claude') })
      if (!playing) continue
      rally++
      tally.steps++
      const { ball, rally: now } = game.sim
      // Wholly above the view of a 24 row court, where the arrow stands in for the ball.
      if (Math.floor(ball.y) - C.BALL_R >= 2 * 24 - groundPx(24)) tally.above++
      const mark = `${now.touchSide} ${now.touches}`
      if (now.touchSide !== null && mark !== touch) tally.touches++
      touch = mark
      for (const e of events) {
        if (e.kind !== 'point') continue
        tally.points[e.side as Side]++
        tally.rallies.push(rally)
        rally = 0
        touch = ''
      }
    }

    return tally
  }

  const own = quick ? 100 : 300
  console.log(`\nmedium against itself, ${own} points a width:`)
  for (const w of WIDTHS) {
    const t = play(w, 31, { you: new AiSource(MEDIUM, 32), claude: new AiSource(MEDIUM, 33) }, own)
    console.log(
      `  ${w} columns: rally median ${seconds(quantile(t.rallies, 0.5))}, 95th percentile ${seconds(quantile(t.rallies, 0.95))}, ` +
        `longest ${seconds(Math.max(...t.rallies))}, ${round(t.touches / t.rallies.length)} touches a rally, the ball above the view ${pct(t.above / t.steps)} of the time`,
    )
  }

  const each = quick ? 20 : 60
  console.log(`\nthe stand-in for you against each level, ${each} points a width, seed and side:`)
  for (const level of [EASY, MEDIUM, HARD] as Level[]) {
    let won = 0
    let all = 0
    let longest = 0
    for (const w of WIDTHS) {
      for (const seed of [1, 2, 3]) {
        for (const side of SIDES) {
          const proxy = new AiSource(PROXY, seed * 7)
          const ai = new AiSource(level, seed * 11)
          const t = play(w, seed * 13, side === 'you' ? { you: proxy, claude: ai } : { you: ai, claude: proxy }, each)
          won += t.points[side]
          all += t.points.you + t.points.claude
          longest = Math.max(longest, ...t.rallies)
        }
      }
    }
    console.log(`  against ${level.name}: ${pct(won / all)} of ${all} points, longest rally ${seconds(longest)}`)
  }

  const pairing = quick ? 120 : 360
  console.log(`\nthe levels against each other, ${pairing} points a width (the tests' lines: 80%, 65%, 65%):`)
  for (const [strong, weak] of [
    [HARD, EASY],
    [MEDIUM, EASY],
    [HARD, MEDIUM],
  ] as Level[][]) {
    if (strong === undefined || weak === undefined) continue
    let won = 0
    let all = 0
    let longest = 0
    for (const w of WIDTHS) {
      const t = play(w, 21, { you: new AiSource(weak, 22), claude: new AiSource(strong, 23) }, pairing)
      won += t.points.claude
      all += t.points.you + t.points.claude
      longest = Math.max(longest, ...t.rallies)
    }
    console.log(`  ${strong.name} beats ${weak.name} in ${pct(won / all)} of ${all} points, longest rally ${seconds(longest)}`)
  }
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
