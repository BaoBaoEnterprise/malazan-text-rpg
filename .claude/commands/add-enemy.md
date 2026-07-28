---
description: Add a new enemy/encounter to the game end-to-end (content, codex, verification).
argument-hint: "<enemy name and idea, e.g. 'a Jaghut tyrant weak to otataral'>"
---

Add a new enemy to **The Barrows of Morn** based on: **$ARGUMENTS**

Use the `add-enemy` skill for the full procedure. In short:
1. Delegate the `web/src/data.js` edits to the `content-designer` agent — combat profile
   (weakness/backfire/neutral), the three reads, `reveals`, referenced `codex` entries, and
   placement in the scenario. The foe must be solvable through study, not stats.
2. Run the `lore-guardian` agent over any new codex/clue text for the copyright rule.
3. Verify with `node --check web/src/data.js`, then playtest the encounter.

If the idea in $ARGUMENTS is thin (no clear weakness or lore hook), ask me one or two quick
questions before writing.
