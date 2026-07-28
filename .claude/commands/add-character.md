---
description: Add a new character (enemy, ally, or neutral) to the game end-to-end (content, codex, verification).
argument-hint: "<character name and idea, e.g. 'a Jaghut tyrant weak to otataral' or 'a friendly Malazan scout'>"
---

Add a new character to **The Barrows of Morn** based on: **$ARGUMENTS**

A character may be a foe, an ally, or a neutral party — not all characters are fought. Use the
`add-character` skill for the full procedure. In short:
1. Delegate the `web/src/data.js` edits to the `content-designer` agent — for a foe, the
   combat profile (weakness/backfire/neutral); for an ally/neutral, the `interactions` and
   their study gates. Plus the three reads, `reveals`, referenced `codex` entries, and
   placement in the scenario. It must be solvable through study, not stats.
2. Run the `lore-guardian` agent over any new codex/clue text for the copyright rule.
3. Verify with `node --check web/src/data.js`, then playtest the encounter.

If the idea in $ARGUMENTS is thin (no clear resolution — no weakness for a foe, or no
interactions for a non-combatant), ask me one or two quick questions before writing.
