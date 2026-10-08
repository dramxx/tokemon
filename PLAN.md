# Tokemon — implementation plan

A tamagotchi that lives in Claude Code, built as a function-hooks mod (plugin).
Your coding feeds it, and you can look after it by hand.

## Decisions (defaults, change before building if needed)

- **No death.** At zero stats the pet sulks (sad face, toasts), it never dies.
- **Slow decay.** About 24h from full to empty, so a weekend away hurts but is recoverable.
- **Status line**, not a band, so it doesn't fight the `progress-band` mod.
- Mod name `tokemon`, slash command `/pet`. The pet starts as an unnamed egg.

## Layout

```
C:\DEV\Tokemon\
  .claude-plugin/plugin.json   { name: "tokemon", version, description, types: "./types/index.d.ts" }
  hooks/hooks.json             { "modules": ["./register.tsx"] }
  hooks/register.tsx           entry: wires the hooks
  hooks/pet.ts                 pure logic: stats, decay, stages, moods (no $ calls, easy to test)
  hooks/art.ts                 ASCII art per stage and mood
  types/index.d.ts             PluginState contract for tokemon
  tests/*.test.ts              claude plugin test
```

## Data model

```ts
type Pet = {
  name: string | null      // null until /pet name
  bornAt: number           // ms epoch
  lastTick: number         // ms epoch, used to apply decay for time away
  hunger: number           // 0..100 (100 = full)
  happy: number            // 0..100
  energy: number           // 0..100
  dirt: number             // 0..100 (100 = filthy)
  asleep: boolean
  care: number             // running care score, drives evolution
  stats: { toolCalls: number; turns: number; feeds: number; plays: number }
}
```

- **Persistence:** `$.store` key `pet` (survives sessions). It's mirrored into `$.state`
  (`tokemon.pet`) so the pane redraws when it changes.
- **Decay:** on `session.start` and every tick (`$.clock.every`, about 60s), apply
  `elapsed = now - lastTick` as a linear drain, then save.

## Mechanics

| Trigger | Effect |
|---|---|
| `tool.call` (any tool) | hunger +1 (small snack), capped |
| `tool.call` Bash with `isError` | brief "worried" mood |
| `turn.complete` | happy +2, care +1 |
| Feed button | hunger +30 |
| Play button | happy +25, energy −10 (refused when asleep or energy < 10) |
| Sleep button | toggles asleep; while asleep energy recovers and other decay is halved |
| Clean button | dirt → 0 |
| Time | hunger/happy/energy drain, dirt rises |

**Stages** (from age and care): egg (< 1h) → baby (< 1 day) → teen (< 4 days, care ≥ X) → adult.
Toast on evolve.

**Moods** (computed): asleep, starving, sad, dirty, worried, happy, ok. Each has a face for the
status line and ASCII art for the pane.

## UI

- **Status line**, refreshed on every change via `$.ui.status(...)`:
  `(•ᴗ•) Byte  ♥♥♥♡  🍖▓▓▓░  ⚡▓▓░░`
- **Pane** `/pet` → `$.ui.open({ id: 'tokemon', title })`, drawn by `ui.render` on
  `{ component: 'Pane', requestId: 'tokemon' }`. It shows the art, stat bars,
  "Fed by" counters, and Feed / Play / Sleep / Clean buttons (`onPress` → update state + store).
  It is only opened on the command (unasked panes need ≥ 144 columns).
- **Commands:** `/pet` opens the pane, `/pet name <name>` names it, `/pet stats` returns a text summary.
- **Toasts:** evolved, starving, "missed you" after a long absence.

## Phases

- [x] **1. Scaffold** — plugin.json, hooks.json, empty register, types contract →
  verify: `claude plugin validate C:\DEV\Tokemon` passes
- [x] **2. Pet logic** (`pet.ts`): create, decay, actions, stage, mood as pure functions →
  verify: unit tests for decay over time, caps, evolve thresholds, no death at 0
- [x] **3. Persistence + tick** — load/save via `$.store`, mirror to `$.state`, decay on
  `session.start` and on a `$.clock.every` tick → verify: test with mocked clock and store
- [ ] **4. Status line** — face + bars, updated on every change → verify: visible in a live session
- [x] **5. Coding feeds it** — `tool.call`, `turn.complete`, Bash failure → verify: test
  that a tool call raises hunger
- [x] **6. Pane + buttons** — `/pet` command, art, bars, Feed/Play/Sleep/Clean → verify:
  `$.ui.mount` test pressing Feed, for both `terminal` and `desktop` surfaces
- [ ] **7. Naming, stats command, toasts** → verify: tests + manual check
- [ ] **8. Art pass + tuning** — art for each stage and mood, tune the decay numbers → verify: play with it
- [x] **9. Share** (optional) — `.claude-plugin/marketplace.json`, README with
  `/plugin install tokemon --marketplace <owner>/<repo>`

## Dev notes

- Load the `plugin-authoring` skill at the start of the session. It points to this build's
  type file (`claude-code.d.ts`, about 14k lines). Grep it for `'tool.call'`, `Pane: {`,
  `store: {`, `clock: {` and `ButtonProps`.
- The module runs sandboxed: no DOM, no Node, no `import()`. Everything goes through `$`.
  JSX elements come from `$.ui.resolve(e)`.
- `$.state` can't be written while a `ui.render` hook is drawing. Write from `onPress` or other events.
- A hot reload re-runs `register` and `session.start`, and cancels timers, so re-arm the tick in `session.start`.
- To run it live: `claude --plugin-dir C:\DEV\Tokemon`, or the skill's dev-mods hot-reload flow.
- Tests: `claude plugin test C:\DEV\Tokemon`. Type-check: `tsc -p C:\DEV\Tokemon` once it has loaded.
