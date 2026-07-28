---
name: add-character
description: Add a new character to The Barrows of Morn end-to-end — enemy, ally, or neutral. Covers combat profile (for foes), non-combat interactions, reads, and codex entries, then verifies it. Use when the user wants to add any character, creature, foe, ally, or NPC to the game.
---

# Add a character to The Barrows of Morn

A character may be a **foe**, an **ally**, or a **neutral** party. Not every character is
fought — many are resolved through `interactions`. Follow these steps. Prefer delegating the
data edit to the `content-designer` agent and the copyright pass to `lore-guardian`.

## 1. Gather the design
Decide the character's name, nature (Soletaken / D'ivers / T'lan Imass / mortal / other), and
**how the player resolves the encounter**:
- **Combat character** → its **correct counter** (`weakness`), what **backfires**, and the
  lore fact that justifies the counter.
- **Non-combat character** (ally/neutral) → the `interactions` available, what each needs the
  player to have studied, and the success vs. `blind` outcomes.

Whatever the type, it should be solvable through study/knowledge, not stats.

## 2. Read the schema
Open `web/src/data.js` and copy the shape of an existing entry (e.g. `gryllen`). Characters
currently all live under `GAME_DATA.enemies` regardless of alignment — the key name is
historical. Note which fields `web/src/engine.js` reads: `weakness`, `backfire`, `neutral`,
`reveals`, `codexRefs`, `interactions`/`needs`, `attackLethal`.
- For a **non-combat** character, keep the combat profile minimal (no real `weakness`, empty
  `backfire`) and carry the encounter with rich `interactions`; set `attackLethal` false so a
  stray "attack" doesn't instantly kill.
- If the user wants a *separate* `allies`/`npcs` data key instead of reusing `enemies`, that's
  an engine change — hand it to the `engine-dev` agent first.

## 3. Write the content in `web/src/data.js`
- Add the character with `id`, `name`, `title`, `nature`, `wounds`, `intro`, the three reads
  (`observe`/`probe`/`recall`), `reveals`, `codexRefs`, `interactions` as needed, and (for
  foes) `weakness`/`backfire`/`neutral`.
- Add any new `codex` entries it references — each with an **original paraphrase** `summary`
  and a `cite`. Set `revealsWeaknessFor` where studying should unlock a payoff.
- Place the character into the scenario/nodes so it's actually reachable in play.

## 4. Copyright check
Run the `lore-guardian` agent over the new codex/clue text. Fix anything it flags.

## 5. Verify
- `node --check web/src/data.js` must pass (the PostToolUse hook also enforces this).
- Serve and playtest the encounter (the `playtest` skill): for a foe, confirm the weakness
  wins and a backfire hurts; for an ally/neutral, confirm each interaction's success and
  `blind` branches, and the study→recall path. A code read is not verification.
