# `.claude/` — Claude Code setup for The Barrows of Morn

This folder configures Claude Code to help develop the game. Nothing here ships to players;
it only shapes how Claude works in this repo.

```
.claude/
  settings.json           Shared project settings: permission allowlist + hook wiring.
  agents/                 Sub-agents (delegate focused work to a fresh context).
    content-designer.md     Adds/edits enemies, codex, scenario in web/src/data.js.
    engine-dev.md           Mechanics & UI in web/src/engine.js / app.js.
    lore-guardian.md        Copyright/paraphrase review of game content (read-only).
  skills/                 Procedures Claude loads on demand.
    add-character/SKILL.md  End-to-end: add a character (foe/ally/neutral), then verify it.
    playtest/SKILL.md       Serve web/ and drive it in a browser to confirm it plays.
  commands/               Slash commands you can type.
    serve.md                /serve [port]  — static-serve web/ for testing.
    add-character.md        /add-character <idea> — scaffold a new character.
  hooks/
    js-syntax-check.sh      PostToolUse: node --check on edited web JS files.
```

Project-wide instructions live in `../CLAUDE.md` (architecture, conventions, the copyright
rule). Start there.

## How the pieces fit
- **Agents** are for delegation — "add three new characters" → `content-designer`; "add a
  stealth mechanic" → `engine-dev`; "check the new lore" → `lore-guardian`.
- **Skills** are step-by-step procedures Claude pulls in automatically when relevant (or you
  can name them).
- **Commands** are things *you* type: `/serve`, `/add-character a Jaghut weak to otataral`.
- **The hook** runs automatically after any edit to `web/**.js` and blocks a syntax error
  before it lands. It no-ops if `node` isn't installed.

## Personal vs. shared
`settings.json` is committed and shared with everyone. For machine-specific overrides
(personal permissions, extra env), create `.claude/settings.local.json` — it's already
gitignored below and is never committed.
