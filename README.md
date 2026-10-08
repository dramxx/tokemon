# Tokemon

A tamagotchi that lives in Claude Code. Your coding feeds it, and you can look after it by hand.

- Every tool call is a small snack, every finished turn makes it happier, a failed Bash command worries it.
- Its face, name, joy, food and energy sit at the right of the prompt footer.
- `/pet` opens its pane with Feed / Play / Sleep / Clean buttons (hotkeys `f` `p` `s` `c`).
- `/pet name <name>` names it, `/pet stats` prints a summary.
- It hatches after an hour, grows up with age and care, and never dies: left alone it just sulks.

## Install

```
/plugin install tokemon --marketplace <owner>/<repo>
```

Answer `y` to add the marketplace, then pick a scope.

## Develop

```
claude --plugin-dir C:\DEV\Tokemon
claude plugin test C:\DEV\Tokemon
```
