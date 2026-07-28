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
  data-driven; adding content should need *no* code changes. Use the `/add-character` command
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

## Branch strategy

Single source of truth for branching — agents and skills reference this section instead of
restating it.

- **`main` is protected** (enforced on GitHub, admins included): no direct pushes, no force
  pushes, no deletion. Everything lands via PR — including docs and scaffolding.
- **Naming:** `feature/<slug>` for features, `fix/<slug>` for bug fixes, `chore/<slug>` for
  docs/scaffolding/tooling. Living World plan phases use `feature/p<N>-<slug>`
  (e.g. `feature/p1-lore-db`).
- **Base:** every branch starts from latest `origin/main` (`git fetch origin` first; note
  the base SHA). One branch = one work order = one PR = one agent — no drive-by changes.
- **Merge method: squash** (`gh pr merge --squash --delete-branch`). One unit of work = one
  clean commit on `main`; review-fix commits are noise history doesn't need.
- **Landing order:** dependency order first, then smallest/least-risky first. After each
  merge, any open branch that now conflicts rebases: `git fetch origin && git rebase
  origin/main`, then `git push --force-with-lease` (feature branches only — never `main`).
- **Dependent work:** if B needs unmerged A, prefer sequencing B after A lands. If B must
  start early, stack it on A's branch, mark the PR "depends on #A", and rebase onto `main`
  when A merges.
- **Cleanup:** remote branch deleted at merge; worktrees removed when their agent finishes.

## Development pipeline (PM → UX → Architect → Junior engineers → Review)

An engineering team working in tandem, not a strict waterfall — PM, UX, and Architect
iterate together before build; UX and Review gate together after.

1. **Product Manager** — the `product-manager` skill (`/pm`). Interviews the user, turns
   answers into numbered user stories with requirements and Given/When/Then acceptance
   criteria in `docs/stories/`. Stories define *what* and *why*; never technical design.
2. **UX Designer** — the `ux-designer` skill (`/ux`). Takes stories with player-facing
   surface and produces UX specs in `docs/ux/`: flows, screen states, wireframes/mockups,
   interaction and error states, mobile-first + accessibility notes. Reviews the *built*
   UI against the spec before merge. Collaborates with the PM (stories may change once
   flows are drawn) and flags feasibility questions to the Architect.
3. **Architect** — the **main session** running the `orchestrate` skill. The experienced
   solution designer: writes the technical design brief, decomposes stories + UX specs
   into **work orders** (spec, interfaces, acceptance criteria, UX spec references,
   expected files), and owns all architectural decisions.
4. **Junior engineers** — `feature-dev` agents, one per work order, in isolated worktrees
   on their own branches. They implement exactly what the work order says, and **ask the
   architect instead of guessing** when a spec is ambiguous or looks wrong. No unilateral
   architecture decisions.
5. **Review** — a `pr-reviewer` agent per PR ranks findings **Critical / High / Medium /
   Low / Nit** and checks the diff against the work order's acceptance criteria, the
   design brief, and (for UI work) the UX spec. The architect then does a final
   design-conformance pass, and UI changes get a UX conformance pass, before merging.
   Merge gate: zero Critical/High. Unfixed Mediums become recorded follow-ups, never
   silently dropped.
