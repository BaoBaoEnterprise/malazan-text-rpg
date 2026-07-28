# `.claude/` — Claude Code setup for The Barrows of Morn

This folder configures Claude Code to help develop the game. Nothing here ships to players;
it only shapes how Claude works in this repo.

```
.claude/
  settings.json           Shared project settings: permission allowlist + hook wiring.
  agents/                 Sub-agents (delegate focused work to a fresh context).
    content-designer.md     Adds/edits characters, codex, scenario in web/src/data.js.
    engine-dev.md           Mechanics & UI in web/src/engine.js / app.js.
    lore-guardian.md        Copyright/paraphrase review of game content (read-only).
    feature-dev.md          Builds ONE feature on its own branch → verified PR.
    pr-reviewer.md          Reviews a PR; ranks findings Critical/High/Medium/Low/Nit.
  skills/                 Procedures Claude loads on demand.
    add-character/SKILL.md  End-to-end: add a character (foe/ally/neutral), then verify it.
    playtest/SKILL.md       Serve web/ and drive it in a browser to confirm it plays.
    orchestrate/SKILL.md    Architect workflow: design → work orders → fan out juniors
                            → two-layer review → gated merge.
    product-manager/SKILL.md  PM role: interview the user → user stories + acceptance
                            criteria in docs/stories/.
    ux-designer/SKILL.md    UX role: flows, screen states, mockups → specs in docs/ux/;
                            reviews built UI against them.
  commands/               Slash commands you can type.
    serve.md                /serve [port]  — static-serve web/ for testing.
    add-character.md        /add-character <idea> — scaffold a new character.
    orchestrate.md          /orchestrate <f1>; <f2>; ... — parallel feature builds.
    pm.md                   /pm <idea> — PM interview → user stories.
    ux.md                   /ux <story|review …> — UX design or UX review.
  hooks/
    js-syntax-check.sh      PostToolUse: node --check on edited web JS files.
```

Project-wide instructions live in `../CLAUDE.md` (architecture, conventions, the copyright
rule). Start there.

## How the pieces fit
- **Agents** are for delegation — "add three new characters" → `content-designer`; "add a
  stealth mechanic" → `engine-dev`; "check the new lore" → `lore-guardian`; one feature
  branch → `feature-dev`; one PR review → `pr-reviewer`.
- **Skills** are step-by-step procedures Claude pulls in automatically when relevant (or you
  can name them).
- **Commands** are things *you* type: `/serve`, `/add-character a Jaghut weak to otataral`,
  `/orchestrate add a stealth system; new region: the Rent; character portraits`.

## The engineering team

The roles work in tandem like a real team. Pipeline and branch rules are documented in
`../CLAUDE.md` (see **Branch strategy** and **Development pipeline**); the short version:

```
/pm  ──► user stories + acceptance criteria        (docs/stories/)
/ux  ──► flows, states, mockups, UX checks         (docs/ux/)
/orchestrate — main session becomes the ARCHITECT:
  writes design brief + work orders                (docs/designs/)
  ├─ feature-dev (junior) @ feature/stealth-system  ──► PR #12 ─┐
  ├─ feature-dev (junior) @ feature/region-the-rent ──► PR #13 ─┤  juniors ask questions
  └─ feature-dev (junior) @ feature/char-portraits  ──► PR #14 ─┤  instead of guessing
                                                                ▼
  layer 1: pr-reviewer per PR → Critical / High / Medium / Low / Nit
           (checks acceptance criteria + design conformance + UX spec)
  layer 2: architect reads the diff vs the design; UX reviews UI flows
                                                                ▼
  merge gate: zero Critical/High → squash-merge & delete branch
              else → findings back to that junior → fix → re-review
```

Severity rubric (defined in `agents/pr-reviewer.md`): **Critical** breaks the game/saves
or violates a non-negotiable (e.g. copyrighted prose) · **High** real bug,
hard-constraint violation, unmet acceptance criterion, or undocumented design deviation ·
**Medium** should fix, mergeable with follow-up · **Low** minor · **Nit** style,
ignorable.

## Why some roles are skills and others are sub-agents

- **Skills (run in the main session): PM, UX, Architect/orchestrate.** These roles must
  *talk to the user* (interviews, mockup feedback, judgment calls) and, for the
  architect, spawn sub-agents — both things only the main session can do. A skill keeps
  the conversation context and the user in the loop.
- **Sub-agents (fresh isolated context): feature-dev, pr-reviewer, content-designer,
  engine-dev, lore-guardian.** Their work is self-contained: a complete brief goes in,
  a result comes back. Isolation is the feature — parallel juniors can't trample each
  other, and a reviewer with a fresh context can't inherit the builder's blind spots.
  The cost: they can't ask the user anything mid-run (questions come back through the
  architect), which is exactly why the interactive roles aren't sub-agents.
- **The hook** runs automatically after any edit to `web/**.js` and blocks a syntax error
  before it lands. It no-ops if `node` isn't installed.

## Personal vs. shared
`settings.json` is committed and shared with everyone. For machine-specific overrides
(personal permissions, extra env), create `.claude/settings.local.json` — it's already
gitignored below and is never committed.
