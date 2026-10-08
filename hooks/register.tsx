import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pet } from '../types'
import { art, face } from './art'
import {
  MISSED_YOU_MS,
  bar,
  canPlay,
  clean,
  create,
  decay,
  displayName,
  feed,
  mood,
  news,
  play,
  rename,
  snack,
  stage,
  toggleSleep,
  turnDone,
  worry,
} from './pet'

const PANE = 'tokemon'
const STORE_KEY = 'pet'
const TICK_MS = 60_000
const pet = atom({ plugin: 'tokemon', key: 'pet' } as const, null)

type Change = { before: Pet; after: Pet; now: number }

/** Decays to now, applies `fn`, saves to state and store; the footer redraws from state. */
async function change($: EngineInterface, fn: (pet: Pet, now: number) => Pet): Promise<Change> {
  const now = await $.clock.now()
  let before = create(now)
  let after = before
  await update($, pet, current => {
    before = current ?? create(now)
    after = fn(decay(before, now), now)
    return after
  })
  await $.store.set(STORE_KEY, after)
  for (const line of news(before, after, now)) $.ui.toast(line)
  return { before, after, now }
}

function statusLine(p: Pet): string {
  const now = p.lastTick
  const hearts = Math.round(p.happy / 25)
  return [
    `${face(stage(p, now), mood(p, now))} ${displayName(p, now)}`,
    '♥'.repeat(hearts) + '♡'.repeat(4 - hearts),
    `🍖${bar(p.hunger)}`,
    `⚡${bar(p.energy)}`,
  ].join('  ')
}

function statsText(p: Pet): string {
  const now = p.lastTick
  const days = Math.floor((now - p.bornAt) / 86_400_000)
  const hours = Math.floor((now - p.bornAt) / 3_600_000) % 24
  return [
    `${displayName(p, now)}, ${stage(p, now)}, ${days}d ${hours}h old, feeling ${mood(p, now)}`,
    `Food ${Math.round(p.hunger)}  Joy ${Math.round(p.happy)}  Energy ${Math.round(p.energy)}  Dirt ${Math.round(p.dirt)}  Care ${p.care}`,
    `Fed by ${p.stats.toolCalls} tool calls, ${p.stats.turns} turns, ${p.stats.feeds} meals, ${p.stats.plays} games`,
  ].join('\n')
}

const USAGE = 'Usage: /pet, /pet name <name>, /pet stats'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pet',
      description: 'Look after your Tokemon',
      argumentHint: '[name <name> | stats]',
    })

    const now = await $.clock.now()
    const stored = (await $.store.get(STORE_KEY)) as Pet | undefined
    const seeded = (await read($, pet)) ?? stored ?? create(now)
    await update($, pet, current => current ?? seeded)
    if (now - seeded.lastTick > MISSED_YOU_MS) {
      $.ui.toast(`${displayName(seeded, now)} missed you!`)
    }
    await change($, p => p)

    // A hot reload cancels timers, so the tick is armed here every time.
    $.clock.every(TICK_MS, () => {
      void change($, p => p)
    })

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const hasFailed = e.tool === 'Bash' && ran.deny === undefined && ran.isError === true
    await change($, (p, now) => (hasFailed ? worry(snack(p), now) : snack(p)))
    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) await change($, turnDone)
    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const [sub = '', ...rest] = e.args.trim().split(/\s+/)

    if (sub === 'name') {
      const name = rest.join(' ').slice(0, 24)
      if (name === '') return { text: 'Usage: /pet name <name>' }
      await change($, p => rename(p, name))
      return { text: `Your Tokemon is now called ${name}.` }
    }

    if (sub === 'stats') {
      const { after } = await change($, p => p)
      return { text: statsText(after) }
    }

    if (sub !== '') return { text: USAGE }

    await change($, p => p)
    await $.ui.open({ id: PANE, title: 'Tokemon' })
    return { text: 'Tokemon is here.' }
  })

  // Drawn as a mode label at the right of the prompt footer, so it sits right-aligned.
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const p = await read($, pet)
    if (p === null) return next(e)
    return next({ ...e, props: { ...e.props, modes: [...e.props.modes, statusLine(p)] } })
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const p = await read($, pet)
    if (p === null) return <Text dimColor>Waking up…</Text>

    const now = p.lastTick
    const s = stage(p, now)
    const m = mood(p, now)
    const onPlay = async () => {
      const { before, after } = await change($, play)
      if (after.stats.plays === before.stats.plays) {
        $.ui.toast(after.asleep ? `${displayName(after, now)} is asleep.` : 'Too tired to play.')
      }
    }

    return (
      <Box flexDirection="column">
        <Text bold>
          {displayName(p, now)} · {s} · {m}
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {art(s, m).map(line => (
            <Text>{line}</Text>
          ))}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text>Food    {bar(p.hunger, 10)}</Text>
          <Text>Joy     {bar(p.happy, 10)}</Text>
          <Text>Energy  {bar(p.energy, 10)}</Text>
          <Text>Dirt    {bar(p.dirt, 10)}</Text>
        </Box>
        <Text dimColor>
          Fed by {p.stats.toolCalls} tool calls, {p.stats.turns} turns, {p.stats.feeds} meals,{' '}
          {p.stats.plays} games
        </Text>
        <Box flexDirection="row" gap={1} marginTop={1}>
          <Button key="feed" hotkey="f" variant="primary" onPress={() => change($, feed)}>
            Feed
          </Button>
          <Button key="play" hotkey="p" dimColor={!canPlay(p)} onPress={onPlay}>
            Play
          </Button>
          <Button key="sleep" hotkey="s" onPress={() => change($, toggleSleep)}>
            {p.asleep ? 'Wake' : 'Sleep'}
          </Button>
          <Button key="clean" hotkey="c" onPress={() => change($, clean)}>
            Clean
          </Button>
        </Box>
      </Box>
    )
  })
}
