---
name: add-enemy
description: Add a new enemy/encounter to The Barrows of Morn end-to-end — combat profile, reads, codex entries, optional non-combat interactions — then verify it. Use when the user wants to add a foe, encounter, or creature to the game.
---

# Add an enemy to The Barrows of Morn

Follow these steps. Prefer delegating the data edit to the `content-designer` agent and the
copyright pass to `lore-guardian`.

## 1. Gather the design
Ask for / decide: the foe's name and nature (Soletaken / D'ivers / T'lan Imass / other), its
**correct counter** (the `weakness`), what **backfires**, and one or two lore facts that
justify the counter. Every foe must be solvable through study, not stats.

## 2. Read the schema
Open `web/src/data.js` and copy the shape of an existing enemy (e.g. `gryllen`). Note which
fields `web/src/engine.js` actually reads: `weakness`, `backfire`, `neutral`, `reveals`,
`codexRefs`, `interactions`/`needs`, `attackLethal`.

## 3. Write the content in `web/src/data.js`
- Add the enemy under `GAME_DATA.enemies` with `id`, `name`, `title`, `nature`, `wounds`,
  `intro`, three `clues` (observe/probe/recall), `reveals`, `codexRefs`,
  `weakness`/`backfire`/`neutral`, and optional `interactions`.
- Add any new `codex` entries it references — each with an **original paraphrase** `summary`
  and a `cite`. Set `revealsWeaknessFor` if studying it should unlock the recall payoff.
- Place the enemy into the scenario/nodes so it's actually reachable in play.

## 4. Copyright check
Run the `lore-guardian` agent over the new codex/clue text. Fix anything it flags.

## 5. Verify
- `node --check web/src/data.js` must pass (the PostToolUse hook also enforces this).
- Serve and playtest the encounter (the `playtest` skill): confirm the weakness wins, a
  backfire hurts, and the study→recall path pays off. A code read is not verification.
