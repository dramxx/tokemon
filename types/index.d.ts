export type Stage = 'egg' | 'baby' | 'teen' | 'adult'

export type Mood = 'asleep' | 'starving' | 'sad' | 'dirty' | 'worried' | 'happy' | 'ok'

export type Pet = {
  name: string | null
  bornAt: number
  lastTick: number
  hunger: number
  happy: number
  energy: number
  dirt: number
  asleep: boolean
  care: number
  worriedUntil: number
  stats: { toolCalls: number; turns: number; feeds: number; plays: number }
}

declare module 'claude-code' {
  interface PluginState {
    tokemon: { pet: Pet | null }
  }
}
