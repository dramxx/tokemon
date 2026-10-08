import { describe, expect, test } from 'claude-code/testing'

import {
  STAGE_AGE,
  STAGE_CARE,
  bar,
  canPlay,
  clean,
  create,
  decay,
  feed,
  mood,
  news,
  play,
  snack,
  stage,
  toggleSleep,
  worry,
} from '../hooks/pet'

const HOUR = 3_600_000
const DAY = 24 * HOUR

describe('decay', () => {
  test('drains linearly over time away', () => {
    const pet = decay({ ...create(0), hunger: 100 }, 12 * HOUR)
    expect(Math.round(pet.hunger)).toBe(50)
    expect(pet.lastTick).toBe(12 * HOUR)
    expect(pet.dirt).toBeGreaterThan(0)
  })

  test('full to empty in about a day', () => {
    const pet = decay({ ...create(0), hunger: 100 }, DAY)
    expect(pet.hunger).toBe(0)
  })

  test('never goes below zero and never dies', () => {
    const pet = decay(create(0), 30 * DAY)
    expect(pet.hunger).toBe(0)
    expect(pet.happy).toBe(0)
    expect(pet.energy).toBe(0)
    expect(pet.dirt).toBe(100)
    expect(mood(pet, 30 * DAY)).toBe('starving')
    expect(feed(pet).hunger).toBe(30)
  })

  test('sleep halves drain and recovers energy', () => {
    const awake = decay({ ...create(0), hunger: 100, energy: 20 }, 4 * HOUR)
    const asleep = decay({ ...create(0), hunger: 100, energy: 20, asleep: true }, 4 * HOUR)
    expect(Math.round((100 - asleep.hunger) * 2)).toBe(Math.round(100 - awake.hunger))
    expect(asleep.energy).toBeGreaterThan(20)
    expect(awake.energy).toBeLessThan(20)
  })
})

describe('actions', () => {
  test('caps at 100', () => {
    expect(feed({ ...create(0), hunger: 90 }).hunger).toBe(100)
    expect(snack({ ...create(0), hunger: 100 }).hunger).toBe(100)
    expect(play({ ...create(0), happy: 90 }).happy).toBe(100)
  })

  test('play is refused when asleep or tired', () => {
    const tired = { ...create(0), energy: 5, happy: 10 }
    expect(canPlay(tired)).toBe(false)
    expect(play(tired)).toEqual(tired)
    const sleeping = toggleSleep(create(0))
    expect(play(sleeping)).toEqual(sleeping)
  })

  test('clean empties dirt', () => {
    expect(clean({ ...create(0), dirt: 80 }).dirt).toBe(0)
  })

  test('worry wears off', () => {
    const pet = worry(create(0), 0)
    expect(mood(pet, 1000)).toBe('worried')
    expect(mood(pet, HOUR)).not.toBe('worried')
  })
})

describe('stages', () => {
  test('egg, then baby after an hour', () => {
    expect(stage(create(0), 0)).toBe('egg')
    expect(stage(create(0), STAGE_AGE.baby)).toBe('baby')
  })

  test('teen needs age and care', () => {
    const pet = create(0)
    expect(stage(pet, STAGE_AGE.teen)).toBe('baby')
    expect(stage({ ...pet, care: STAGE_CARE.teen }, STAGE_AGE.teen)).toBe('teen')
  })

  test('adult needs more age and care', () => {
    const pet = { ...create(0), care: STAGE_CARE.teen }
    expect(stage(pet, STAGE_AGE.adult)).toBe('teen')
    expect(stage({ ...pet, care: STAGE_CARE.adult }, STAGE_AGE.adult)).toBe('adult')
  })

  test('news says when it hatched', () => {
    const before = create(0)
    const after = decay(before, STAGE_AGE.baby)
    expect(news(before, after, STAGE_AGE.baby)).toContain('The egg hatched! Name it with /pet name <name>.')
  })
})

test('bar', () => {
  expect(bar(100)).toBe('▓▓▓▓')
  expect(bar(50)).toBe('▓▓░░')
  expect(bar(0)).toBe('░░░░')
})
