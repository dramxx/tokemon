import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

import type { Pet } from '../types'
import { create } from '../hooks/pet'

const HOUR = 3_600_000
const START = { cwd: '.', surface: 'terminal', isInteractive: true } as const

/** Mocks the world beneath the plugin and records what it shows. */
function world(on: On, stored?: Pet) {
  const clock = mock.clock(on, { now: 100 * HOUR })
  const store = new Map<string, unknown>(stored ? [['pet', stored]] : [])
  const shown = { toasts: [] as string[] }
  on('store.get', ($, e) => ({ value: store.get(e.key) }))
  on('store.set', ($, e) => {
    store.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    shown.toasts.push(e.text)
    return { value: undefined }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('tool.call', ($, e) =>
    e.tool === 'Bash' ? { result: {}, text: 'boom', isError: true } : { result: {}, text: 'ok' },
  )
  const pet = () => store.get('pet') as Pet
  return { clock, shown, pet }
}

const run = ($: Engine, args: string) =>
  $.command.run({
    command: 'pet',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })

test('loads the stored pet and decays it for the time away', async ($, on) => {
  const { clock, pet } = world(on, { ...create(90 * HOUR), hunger: 100 })
  await $.session.start(START)
  expect(Math.round(pet().hunger)).toBe(58)
  expect(pet().lastTick).toBe(clock.now())
})

test('a new session hatches an egg, the tick decays it', async ($, on) => {
  const { clock, pet } = world(on)
  await $.session.start(START)
  const first = pet()
  expect(first.bornAt).toBe(100 * HOUR)
  await clock.advance(60 * 60_000)
  const later = pet()
  expect(later.lastTick).toBe(101 * HOUR)
  expect(later.hunger).toBeLessThan(first.hunger)
})

test('missed you after a long absence', async ($, on) => {
  const { shown } = world(on, { ...create(80 * HOUR), name: 'Byte' })
  await $.session.start(START)
  expect(shown.toasts).toContain('Byte missed you!')
})

test('the footer mode label shows face, name and bars', async ($, on) => {
  world(on, { ...create(0), name: 'Byte', lastTick: 100 * HOUR, hunger: 100, happy: 100, energy: 50, care: 0 })
  on('ui.render', { component: 'SessionMode' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>{e.props.modes.join(' & ')}</Text>
  })
  await $.session.start(START)
  const ui = await $.ui.mount({ plugin: 'tokemon', surface: 'terminal', component: 'SessionMode', props: { modes: ['focus'] } })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('focus & (•ᴗ•) Byte  ♥♥♥♥  🍖▓▓▓▓  ⚡▓▓░░')
  await ui.unmount()
})

test('a tool call feeds it, a failed Bash worries it', async ($, on) => {
  const { pet } = world(on, { ...create(0), lastTick: 100 * HOUR, hunger: 50 })
  await $.session.start(START)
  await $.tool.call({ tool: 'Read', file_path: 'a.txt' })
  const fed = pet()
  expect(fed.hunger).toBe(51)
  expect(fed.stats.toolCalls).toBe(1)
  await $.tool.call({ tool: 'Bash', command: 'false' })
  const worried = pet()
  expect(worried.worriedUntil).toBeGreaterThan(worried.lastTick)
})

test('a finished turn makes it happier', async ($, on) => {
  const { pet } = world(on, { ...create(0), lastTick: 100 * HOUR, happy: 50 })
  on('turn.complete', () => ({ text: '' }))
  await $.session.start(START)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
  const p = pet()
  expect(p.happy).toBe(52)
  expect(p.care).toBe(1)
})

test('/pet name and /pet stats', async ($, on) => {
  world(on)
  await $.session.start(START)
  const named = await run($, 'name Byte')
  expect(named.text).toBe('Your Tokemon is now called Byte.')
  const stats = await run($, 'stats')
  expect(stats.text).toMatch(/^Byte, egg, 0d 0h old/)
})

test('evolving raises a toast', async ($, on) => {
  const { clock, shown } = world(on)
  await $.session.start(START)
  await clock.advance(HOUR)
  expect(shown.toasts).toContain('The egg hatched! Name it with /pet name <name>.')
})

for (const surface of ['terminal', 'desktop'] as const) {
  test(`pane buttons work on ${surface}`, async ($, on) => {
    const { pet } = world(on, { ...create(0), lastTick: 100 * HOUR, hunger: 20, dirt: 80, energy: 5 })
    await $.session.start(START)
    await run($, '')
    const ui = await $.ui.mount({
      plugin: 'tokemon',
      surface,
      component: 'Pane',
      requestId: 'tokemon',
      props: { title: 'Tokemon', isFocused: false, bodyColumns: 60, placement: 'dock' } as never,
    })
    expect((await ui.find({ type: 'Text', text: /^Food/ }))?.text).toContain('▓▓░░░░░░░░')

    await ui.press({ key: 'feed' })
    expect(pet().hunger).toBe(50)
    expect((await ui.find({ type: 'Text', text: /^Food/ }))?.text).toContain('▓▓▓▓▓░░░░░')

    await ui.press({ key: 'clean' })
    expect(pet().dirt).toBe(0)

    await ui.press({ key: 'play' })
    expect(pet().stats.plays).toBe(0)

    await ui.press({ key: 'sleep' })
    expect(pet().asleep).toBe(true)
    expect((await ui.find({ key: 'sleep' }))?.text).toBe('Wake')
    await ui.unmount()
  })
}
