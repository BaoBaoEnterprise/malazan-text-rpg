# The Barrows of Morn — project guide for Claude

A turn-based, **Malazan-flavored text RPG** you win by **wit, not numbers**: read a foe,
research it in a cited in-game Codex, then apply the right counter. The playable game is
the PWA in `web/`. The Python files at the repo root are the **legacy** Spider-Man
prototype — kept for history, not the active project.

## Architecture (read before editing)

```
web/
  index.html        app shell (loads the three scripts, no bundler)
  style.css         mobile-first dark theme
  manifest.json     PWA metadata
  sw.js             service worker (offline / installable) — bump cache name on release
  src/data.js       ALL game content: approaches, enemies, codex, scenario  → GAME_DATA
  src/engine.js     pure turn-based state machine                           → Engine (IIFE)
  src/app.js        UI + save/load, drives Engine                           → IIFE, no exports
  icons/            app icons
```

**No build step, no ES modules, no fetch.** Scripts are plain `<script>` tags sharing
globals (`GAME_DATA`, `Engine`). Keep it that way — it must run by opening `index.html`
directly and work offline as a PWA.

## Where changes go

- **New enemy, codex entry, or scenario node → `src/data.js` only.** The engine and UI are
  data-driven; adding content should need *no* code changes. Use the `/add-enemy` command
  or the `content-designer` agent.
- **New mechanic / state transition → `src/engine.js`** (keep it pure: state in, result
  out, no DOM). Then wire the UI in `src/app.js`. Use the `engine-dev` agent.
- **Bumped any cached asset → update the cache name in `sw.js`** or players get stale files.

## data.js conventions

- An enemy has a **combat** profile (`weakness` / `backfire` / `neutral` arrays of approach
  ids) and optional non-combat `interactions`.
- `reveals` maps a read action (`observe` / `probe` / `recall`) → codex id(s) it unlocks.
- **`recall` lore is gated**: it only pays off once the matching codex entry has been
  `studied`. Every enemy must be beatable through study — never a pure stat check.
- Codex entries carry a `summary` and a `cite`. See the copyright rule below.

## Lore & copyright — hard rule

The Malazan setting is Steven Erikson / Ian C. Esslemont's IP. This is a **non-commercial
fan project**. Every codex `summary` and character description must be an **original
paraphrase** with a citation pointing to *where* a topic appears in the books —
**never verbatim text** from the novels. The `lore-guardian` agent checks this; run it
before committing content changes.

## Running & testing

```bash
cd web && python3 -m http.server 8000   # then open http://localhost:8000
```

Or use the `/serve` command. To verify a change actually plays, use the `playtest` skill
(drives the game in the browser), not just a glance at the code.

## Conventions

- 2-space indent, semicolons, single quotes in JS.
- Escape all user/content strings before inserting into HTML (`esc()` in `app.js`).
- Default branch is `main`. Commit messages are terse and imperative.
