import type { Mood, Pet, Stage } from '../types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// Points per hour. Hunger empties in about a day; asleep, the drains halve.
export const RATES = {
  hunger: 100 / 24,
  happy: 100 / 30,
  energy: 100 / 36,
  dirt: 100 / 48,
  sleepRecovery: 100 / 8,
}

export const STAGE_AGE = { baby: HOUR, teen: DAY, adult: 4 * DAY }
export const STAGE_CARE = { teen: 20, adult: 60 }

export const STARVING = 15
export const WORRY_MS = 2 * MINUTE
export const MISSED_YOU_MS = 12 * HOUR

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function create(now: number): Pet {
  return {
    name: null,
    bornAt: now,
    lastTick: now,
    hunger: 80,
    happy: 80,
    energy: 100,
    dirt: 0,
    asleep: false,
    care: 0,
    worriedUntil: 0,
    stats: { toolCalls: 0, turns: 0, feeds: 0, plays: 0 },
  }
}

/** Applies the drain for the time since `lastTick`. */
export function decay(pet: Pet, now: number): Pet {
  const hours = Math.max(0, now - pet.lastTick) / HOUR
  const drain = pet.asleep ? hours / 2 : hours
  return {
    ...pet,
    lastTick: Math.max(pet.lastTick, now),
    hunger: clamp(pet.hunger - RATES.hunger * drain),
    happy: clamp(pet.happy - RATES.happy * drain),
    energy: clamp(
      pet.asleep ? pet.energy + RATES.sleepRecovery * hours : pet.energy - RATES.energy * hours,
    ),
    dirt: clamp(pet.dirt + RATES.dirt * drain),
  }
}

export function snack(pet: Pet): Pet {
  return {
    ...pet,
    hunger: clamp(pet.hunger + 1),
    stats: { ...pet.stats, toolCalls: pet.stats.toolCalls + 1 },
  }
}

export function worry(pet: Pet, now: number): Pet {
  return { ...pet, worriedUntil: now + WORRY_MS }
}

export function turnDone(pet: Pet): Pet {
  return {
    ...pet,
    happy: clamp(pet.happy + 2),
    care: pet.care + 1,
    stats: { ...pet.stats, turns: pet.stats.turns + 1 },
  }
}

export function feed(pet: Pet): Pet {
  return {
    ...pet,
    hunger: clamp(pet.hunger + 30),
    care: pet.care + 1,
    stats: { ...pet.stats, feeds: pet.stats.feeds + 1 },
  }
}

export function canPlay(pet: Pet): boolean {
  return !pet.asleep && pet.energy >= 10
}

export function play(pet: Pet): Pet {
  if (!canPlay(pet)) return pet
  return {
    ...pet,
    happy: clamp(pet.happy + 25),
    energy: clamp(pet.energy - 10),
    care: pet.care + 1,
    stats: { ...pet.stats, plays: pet.stats.plays + 1 },
  }
}

export function toggleSleep(pet: Pet): Pet {
  return { ...pet, asleep: !pet.asleep }
}

export function clean(pet: Pet): Pet {
  return { ...pet, dirt: 0, care: pet.dirt > 30 ? pet.care + 1 : pet.care }
}

export function rename(pet: Pet, name: string): Pet {
  return { ...pet, name }
}

export function stage(pet: Pet, now: number): Stage {
  const age = now - pet.bornAt
  if (age < STAGE_AGE.baby) return 'egg'
  if (age < STAGE_AGE.teen || pet.care < STAGE_CARE.teen) return 'baby'
  if (age < STAGE_AGE.adult || pet.care < STAGE_CARE.adult) return 'teen'
  return 'adult'
}

export function mood(pet: Pet, now: number): Mood {
  if (pet.asleep) return 'asleep'
  if (pet.hunger < STARVING) return 'starving'
  if (now < pet.worriedUntil) return 'worried'
  if (pet.dirt > 70) return 'dirty'
  if (pet.happy < 25) return 'sad'
  if (pet.happy > 70 && pet.hunger > 50) return 'happy'
  return 'ok'
}

export function displayName(pet: Pet, now: number): string {
  return pet.name ?? (stage(pet, now) === 'egg' ? 'Egg' : 'Tokemon')
}

/** `▓▓▓░` for `cells` cells. */
export function bar(value: number, cells = 4, full = '▓', empty = '░'): string {
  const filled = Math.round((clamp(value) / 100) * cells)
  return full.repeat(filled) + empty.repeat(cells - filled)
}

/** What changed between two snapshots that deserves a toast. */
export function news(before: Pet, after: Pet, now: number): string[] {
  const lines: string[] = []
  const name = displayName(after, now)
  const was = stage(before, before.lastTick)
  const is = stage(after, now)
  if (stageRank(is) > stageRank(was)) {
    lines.push(
      is === 'baby'
        ? `The egg hatched!${after.name ? '' : ' Name it with /pet name <name>.'}`
        : `${name} grew into ${is === 'adult' ? 'an adult' : 'a teen'}!`,
    )
  }
  if (before.hunger >= STARVING && after.hunger < STARVING) {
    lines.push(`${name} is starving. /pet to feed it.`)
  }
  return lines
}

function stageRank(s: Stage): number {
  return ['egg', 'baby', 'teen', 'adult'].indexOf(s)
}
