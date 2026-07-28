# Living World — Implementation Plan

Turn *The Barrows of Morn* from a static vertical-slice PWA into a **live, Claude-driven
Malazan RPG**: randomized lore-grounded characters and stories, characters that think and
converse, and areas that change in response to play.

**Locked decisions** (2026-07-28):
- **Architecture:** Living World server only — the game requires a local server; no offline
  content-pack mode.
- **Dialogue:** freeform text input *plus* generated reply choices.
- **Lore DB:** grounded primarily in a **private local corpus of the actual books** (user
  owns them; corpus is gitignored and never committed/distributed), with the Malazan Wiki
  (CC-BY-SA) as an optional secondary index. Game-facing text is always original
  paraphrase — see §5.
- **Play context:** desktop browser on the same Mac (localhost only).
- **Claude access:** headless `claude -p` sessions via the installed Claude Code CLI
  (v2.1.220) — billed to the Max subscription, **never** the API key path.
- **Server language:** Python 3 (already on the machine; `node` is not installed).

---

## 1. Target architecture

```
┌─────────────────────────────  Mac (localhost)  ─────────────────────────────┐
│                                                                             │
│  Browser (web/)                    Game Master server (server/, Python)     │
│  ┌──────────────────┐   HTTP/SSE   ┌────────────────────────────────────┐   │
│  │ app.js  (render, │ ◄──────────► │ FastAPI app                        │   │
│  │ chat UI, choices)│              │  ├─ claude_harness.py  (subprocess │   │
│  │ engine.js (view- │              │  │   wrapper around `claude -p`)   │   │
│  │ side rules only) │              │  ├─ gm.py         (world/story)    │   │
│  └──────────────────┘              │  ├─ characters.py (minds/dialogue) │   │
│                                    │  ├─ guardian.py   (lore/copyright) │   │
│                                    │  └─ retrieval.py  (lore search)    │   │
│                                    └───────┬────────────────┬───────────┘   │
│                                            │                │               │
│                                    lore/lore.db      world/world.db         │
│                                    (static lore,     (live game state:      │
│                                     FTS5 search)      areas, cast, events,  │
│                                                       memories = the save)  │
└─────────────────────────────────────────────────────────────────────────────┘
```

Principles:
- **Server is authoritative.** World state lives in `world/world.db` (SQLite). The browser
  becomes a renderer + input surface; `localStorage` is at most a cache of the session id.
- **Claude never freewheels.** Every generation call receives retrieved lore rows as
  context, must return JSON matching a schema, and passes a guardian check before the
  result touches the world.
- **Deterministic mechanics stay deterministic.** Combat/read/counter resolution remains
  rule-code (ported server-side); Claude generates *content and consequences*, not dice.
- **The existing game is the floor, not discarded.** Current encounter mechanics
  (observe/probe/recall, weakness/backfire, codex gating) become the combat layer inside
  the living world.

## 2. Component design

### 2.1 Claude harness (`server/claude_harness.py`)
One module owns every headless invocation so CLI-flag drift is contained.

- Wraps `claude -p --output-format json` via `subprocess`, with:
  - `--append-system-prompt` for the role (GM / named character / guardian);
  - `--allowedTools ""` (no tools) — the server does retrieval and passes lore rows inline,
    which is simpler and safer than giving sessions filesystem access;
  - `--model` per role (see §6 cost tiering);
  - a per-call timeout and one retry on malformed JSON (re-prompt with the validation
    error appended).
- Two calling modes:
  - **stateless**: prompt in → JSON out (guardian checks, area generation);
  - **conversational**: `--session-id`/`--resume` per character conversation, with a
    rebuild-from-dossier fallback if a resumed session is stale or errors. Rebuild is the
    reliability path; resume is the optimization.
- Every call is logged to `world/telemetry.jsonl` (role, model, duration, tokens if
  reported) so subscription usage stays visible.

### 2.2 Lore database (`lore/`)
The single source of truth for what is *true* in this Malazan.

- **Book corpus (primary, PRIVATE)** (`lore/books/`, **gitignored**): the user-supplied
  novels in readable format, chunked (by chapter/scene) into a `book_chunks` table with
  book/chapter metadata for citations and spoiler tiers. **Boundary rules:** the corpus
  and anything containing raw book text never gets committed (the repo is public on
  GitHub), never leaves this machine, and is used only as retrieval grounding + an
  n-gram reference. Personal use of books the user owns, no distribution.
- **Wiki ingest (secondary, optional)** (`lore/ingest.py`): pull pages from the Malazan
  Wiki via the MediaWiki API (rate-limited, cached to `lore/raw/`, also gitignored).
  CC-BY-SA — keep an auto-generated `lore/ATTRIBUTION.md`; useful as a structured index
  (names, relations, timelines) complementing the books' prose.
- **Paraphrase pass**: headless sessions convert source chunks into `entries` rows:
  `id, slug, type (character|race|warren|place|event|item|faction), summary (original
  paraphrase), relations (json), spoiler_tier (book 1..10), citations (book+chapter
  refs), sources`. The guardian diffs each summary against its source chunks with an
  n-gram overlap check — with the corpus local this check now covers **novel text too**,
  not just wiki text — and rejects copied prose. `entries` (original prose + citations)
  is committable; its sources are not.
- **Retrieval** (`server/retrieval.py`): SQLite FTS5 search + relation-graph walk.
  `retrieve(query, k, max_spoiler_tier)` returns rows every prompt is grounded in.
- **Spoiler tiers**: the player picks "I've read through book N"; generation is capped at
  that tier so the game never spoils the books.
- Initial scope: ~150 entries centered on the current setting (Seven Cities / Path of
  Hands era — Soletaken, D'ivers, T'lan Imass, warrens, plus the named cast already in
  `data.js`), expanding on demand.

### 2.3 Game Master (`server/gm.py`)
A stateless-per-call "GM" role that owns story and world mutation.

- **New game**: generates a region (6–10 area nodes with edges), a cast (3–6 characters
  from a mix of lore-canonical figures and *randomized originals* consistent with lore),
  and a story arc (goal, stakes, 3-act beat sheet) — all as JSON, all grounded in
  retrieved lore rows, all guardian-checked, then written to `world.db`.
- **World ticks**: after significant player actions, an async GM call receives the event
  log diff and returns `world_effects`: area description changes, new/removed edges, cast
  movements, arc-beat advancement. Applied atomically to `world.db`.
- **Latency hiding**: the GM pre-generates one step ahead (likely-next areas, the next
  arc beat) in a background thread while the player reads/acts.

### 2.4 Character minds (`server/characters.py`)
Each named character is a **dossier + memory**, not just a stat block.

- Dossier (row in `world.db`, rendered to the prompt): identity, voice notes, goals,
  secrets, disposition toward the player, **knowledge boundaries** (what this character
  cannot know — enforces both lore accuracy and spoiler tiers), and links to lore entries.
- Memory: append-only log of conversation summaries + world events witnessed. Prompt =
  dossier + last-K memory + current scene. This makes conversations survive server
  restarts without depending on `--resume`.
- **Dialogue turn contract** — the model must return:
  ```json
  { "say": "...", "mood": "wary", "choices": ["...", "...", "..."],
    "reveals": ["codex_id"], "world_effects": [ ... ], "memory_note": "..." }
  ```
  `choices` power the choice buttons; the free-text box sends arbitrary player input into
  the same turn loop. `reveals` unlocks codex entries (conversation becomes a *fourth
  read* alongside observe/probe/recall — talking to the right person is research).
  `world_effects` are applied via the same guarded pipeline as GM effects.
- Guardrails in the system prompt: stay in character, never break the fourth wall, never
  contradict provided lore rows, refuse knowledge beyond the boundary, keep replies short
  (2–5 sentences) for game pacing.

### 2.5 Guardian pipeline (`server/guardian.py`)
Every generated artifact passes three gates before entering the world:

1. **Schema** — `jsonschema` validation (pure Python, no model call).
2. **Lore & copyright** — a headless guardian call: given the artifact + the lore rows it
   was grounded in, flag contradictions, out-of-scope knowledge, spoiler-tier violations,
   and lifted prose. (Mirrors the existing `lore-guardian` agent, but automated.)
3. **N-gram overlap** vs. `raw_pages` for anything derived from wiki text.

Fail → regenerate once with the guardian's feedback appended; fail again → fall back to
canned content and log it. The game never blocks on a stubborn generation.

### 2.6 Front end (`web/`)
Stays no-build vanilla JS; becomes a thin client.

- `app.js`: add a tiny `api.js` (fetch wrapper + SSE listener), a conversation panel
  (character portrait line, streamed reply text, choice buttons, free-text input), and
  "the world is thinking" states for generation latency.
- `engine.js`: encounter *presentation* rules stay; authoritative resolution moves
  server-side (port the ~180 lines to `server/mechanics.py`).
- `sw.js`: simplify to app-shell caching only (the game needs the server anyway); keep
  installability as a nicety.
- Streaming: character replies stream over SSE so long generations feel alive.

## 3. Phases & deliverables

Each phase ends **playable and verified** (playtest skill), and is a natural commit/PR.

**Phase 0 — Foundations** (small)
- `server/` skeleton: FastAPI + uvicorn in a `venv`, `make dev` (or `./dev.sh`) that
  starts the server and serves `web/`.
- `claude_harness.py` with stateless + conversational modes and a smoke test
  (`python -m server.smoke` does a real `claude -p` JSON round-trip).
- Exit: `curl localhost:8000/api/health` returns model/CLI availability.

**Phase 1 — Lore DB**
- Book-corpus ingest: chunk the user-supplied novels into `book_chunks` (gitignored
  inputs), with book/chapter metadata for citations and spoiler tiers; gitignore +
  pre-commit guard in place **before** any book file lands on disk.
- Optional wiki ingest with caching + rate limiting; `ATTRIBUTION.md` generation.
- Paraphrase pipeline + n-gram checker (against books and wiki); FTS5 retrieval over
  entries and chunks; spoiler tiers.
- Exit: `retrieve("d'ivers", 5, tier=4)` returns clean, cited, original-prose rows;
  spot-check 20 entries by hand; verify `git status` shows no corpus files.

**Phase 2 — GM MVP: generated worlds**
- `POST /api/session/new` → region + cast + arc in `world.db`; client renders the region
  and lets the player move between areas; mechanics ported server-side; existing
  encounter flow works against generated foes.
- Exit: two consecutive new games produce different, lore-consistent regions/casts, and
  a generated foe is beatable via the study→recall path.

**Phase 3 — Conversations**
- Character minds, dialogue contract, choices+freeform UI, SSE streaming, memory
  persistence, conversation-as-research (`reveals`).
- Exit: a 10-turn conversation where the character remembers turn 1 at turn 10, stays in
  voice, refuses out-of-boundary knowledge, and a reveal unlocks a codex entry that then
  gates a recall payoff.

**Phase 4 — Dynamic world**
- Event log + GM ticks + `world_effects` application; areas visibly change after player
  actions; arc beats advance; one-step-ahead pregeneration.
- Exit: burn the barrow → return later → the area's description, encounters, and at least
  one character's dialogue acknowledge it.

**Phase 5 — Fidelity, cost & polish**
- Guardian hardening (adversarial test set of deliberately-wrong artifacts), model
  tiering per role, telemetry review, save snapshots (`world.db` copy = save slot),
  latency polish, `.claude/` scaffolding updates (a `server-dev` agent; extend `playtest`
  to drive conversations).

## 4. Repo layout after Phase 2

```
server/          FastAPI app, claude harness, gm/characters/guardian/retrieval, mechanics
lore/            ingest.py, books/ (PRIVATE, gitignored), raw/ (gitignored), lore.db,
                 ATTRIBUTION.md
world/           world.db, saves/, telemetry.jsonl   (gitignored except .gitkeep)
web/             thin client (existing files, evolved)
docs/            this plan
```

## 5. Lore-fidelity rules (restated, they govern everything)

1. Prompts are **grounded**: no generation call goes out without retrieved lore rows.
2. Output is **checked**: schema → guardian → (where possible) n-gram overlap.
3. Knowledge is **bounded**: spoiler tiers cap what the world and its characters know.
4. Prose is **original**: game-facing text is paraphrase-with-citation, never verbatim
   novel text. Short source excerpts may ground prompts *locally* for fidelity, but every
   output is n-gram-checked against the full private corpus before it enters the world —
   grounding goes in, only original prose comes out.
5. Sources are **contained**: the book corpus and raw wiki cache are gitignored and never
   leave this machine. The public repo only ever contains original-paraphrase entries and
   code. If the game is ever shared/hosted beyond personal use, revisit this section.
6. The project stays **non-commercial** personal fan work.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Max-subscription rate limits (5-hour windows) during heavy play | Model tiering: small model (haiku) for chatter/guardian n-gram triage, mid/large only for GM world-gen and pivotal dialogue; aggressive one-step-ahead caching; telemetry so you can see burn rate; graceful "the world holds its breath" UI state when throttled. |
| Generation latency breaks immersion | SSE streaming, pregeneration, choices render instantly from the last turn while free-text goes live. |
| `claude` CLI flag/behavior drift across versions | All invocations behind `claude_harness.py`; smoke test in CI-ish `dev.sh`; pin expectations in one place. |
| Resumed sessions dying mid-conversation | Dossier+memory rebuild is the primary mechanism; `--resume` is only an optimization. |
| Lore drift / hallucinated canon | Grounded prompts + guardian gate + knowledge boundaries; guardian failures fall back to canned content rather than shipping errors. |
| Book text leaking into the public repo | `lore/books/`, `lore/raw/`, and any table holding source text are gitignored from day one; a pre-commit check greps staged files for corpus paths; paraphrase `entries` are the only committable lore artifact. |
| Game output reproducing novel prose | Guardian n-gram check runs against the full local corpus on every generated artifact; grounding excerpts kept short; characters prompted to speak in their own voice, not quote. |
| CC-BY-SA obligations (wiki path) | Auto-generated attribution file; share-alike noted on derived entries; non-commercial. |
| Wiki scraping etiquette | MediaWiki API, rate-limited, cached raw pages so ingest runs once. |
| Scope creep (this is a big build) | Phases are independently playable; stop after any phase and the game is still better than today. |

## 7. Open items (decide during build, none block Phase 0)

- FastAPI vs. pure-stdlib server (plan assumes FastAPI in a venv; stdlib fallback if you
  want zero pip installs).
- Whether conversations should ever be able to *start combat* directly (`world_effects`
  could trigger an encounter — probably yes, Phase 4).
- Save-slot UX (multiple `world.db` snapshots vs. single rolling save).
- Whether to rename `GAME_DATA.enemies` → `characters` during the Phase 2 port (natural
  moment, since mechanics move server-side anyway).
