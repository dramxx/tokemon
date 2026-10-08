import type { Mood, Stage } from '../types'

export const FACES: Record<Mood, string> = {
  happy: '•ᴗ•',
  ok: '•_•',
  sad: '╥_╥',
  starving: '×﹏×',
  dirty: '≖_≖',
  worried: '°□°',
  asleep: '-_-',
}

const ART: Record<Stage, string[]> = {
  egg: [
    '    .-"""-.   ',
    '   /  . .  \\  ',
    '  |  .  ,   | ',
    '   \\  ,  . /  ',
    "    '-----'   ",
  ],
  baby: [
    '              ',
    '    .-----.   ',
    '   (  {f}  )  ',
    "    '-----'   ",
    '     "   "    ',
  ],
  teen: [
    '    /\\_/\\     ',
    '   ( {f} )    ',
    '   /|   |\\    ',
    '    |___|     ',
    '    d   b     ',
  ],
  adult: [
    '   /\\___/\\    ',
    '  (  {f}  )   ',
    '  /|  ♥  |\\   ',
    ' / |_____| \\  ',
    '    J   L     ',
  ],
}

/** `(•ᴗ•)` for the status line; an egg is an egg. */
export function face(stage: Stage, mood: Mood): string {
  if (stage === 'egg') return '(  )'
  return mood === 'asleep' ? `(${FACES.asleep})ᶻᶻ` : `(${FACES[mood]})`
}

export function art(stage: Stage, mood: Mood): string[] {
  const lines = ART[stage].map(line => line.replace('{f}', FACES[mood]))
  return mood === 'asleep' && stage !== 'egg' ? [...lines.slice(1), '      z z Z   '] : lines
}
