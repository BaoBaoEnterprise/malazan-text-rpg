# Living World — Implementation Plan

Turn *The Barrows of Morn* from a static vertical-slice PWA into a **live, Claude-driven
Malazan RPG**: randomized lore-grounded characters and stories, characters that think and
converse, and areas that change in response to play.

**Locked decisions** (2026-07-28):
- **Architecture:** Living World server only — the game requires a local server; no offline
  content-pack mode.
- **Dialogue:** freeform text input *plus* generated reply choices.
- **Lore DB:** a **private local corpus of the actual books** (user owns them; corpus is
  gitignored and never committed/distributed) plus the Malazan Wiki (CC-BY-SA) as a
  structured index. Model-facing grounding comes from wiki text + entries + Claude's own
  knowledge; the corpus is a **reference-only store** — see the next bullet and §5.
- **Text boundary** (locked 2026-07-31): **verbatim book text never leaves the machine —
  not even inside a prompt.** The model finds passages *by reference* (semantic search
  over locally-computed embeddings); only the server ever touches raw text, for two
  purposes: displaying real quotes to the player and n-gram checking. Consequence: the
  game can show the player **actual cited quotes** from the books (personal use of owned
  copies, localhost only), while everything the model *writes* remains original prose.
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
- **The model never sees the books.** Prompt-facing lore rows are wiki-derived text and
  original-paraphrase entries only. Book chunks are addressable by id — findable via
  semantic search, fetchable only by server-side display and guardian code. The prompt
  builder has no code path to raw chunk text, and outgoing prompts are n-gram-checked
  against the corpus as a tripwire (§2.5).
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

- **Book corpus (reference-only, PRIVATE)** (`lore/books/`, **gitignored**): the
  user-supplied novels in readable format, chunked (by chapter/scene) into a
  `book_chunks` table with book/chapter metadata for citations and spoiler tiers.
  Chunks and their embeddings live in `lore/corpus.db` — a **separate, gitignored**
  database from the committable `lore.db` (entries), so "commit the lore" can never
  drag source text along with it.
  **Boundary rules:** the corpus and anything containing raw book text never gets
  committed (the repo is public on GitHub) and never leaves this machine — **including
  in prompts**. Raw chunk text is consumed only by (a) the player-facing quote panel and
  (b) the guardian's n-gram checks. Personal use of books the user owns, no distribution.
- **Quote retrieval (find by reference, fetch locally)**: chunks are indexed two ways —
  FTS5 for keyword search, and vector embeddings computed by a **local embedding model**
  (e.g. sentence-transformers on CPU/MPS; a hosted embedding API would send the text
  out, so it's ruled out). Hybrid rank-merge gives `find_quotes(query, k, max_spoiler_tier)
  -> [{chunk_id, book, chapter, score}]` — the model (or the player's codex search) asks
  in its own words ("the scene where the Chain of Dogs ends") and gets back *references
  and citations, never text*. A separate `get_chunk_text(chunk_id)`, callable only from
  the quote-panel renderer and `guardian.py`, pulls the actual passage for local display:
  the player sees Erikson's real words, cited, straight from disk to browser.
- **Wiki ingest (secondary, optional)** (`lore/ingest.py`): pull pages from the Malazan
  Wiki via the MediaWiki API (rate-limited, cached to `lore/raw/`, also gitignored).
  CC-BY-SA — keep an auto-generated `lore/ATTRIBUTION.md`; useful as a structured index
  (names, relations, timelines) complementing the books' prose.
- **Entry generation**: headless sessions write `entries` rows:
  `id, slug, type (character|race|warren|place|event|item|faction), summary (original
  paraphrase), relations (json), spoiler_tier (book 1..10), citations (book+chapter
  refs), sources`. Prompts are grounded in **wiki text + Claude's own knowledge of the
  series** — never book chunks. The corpus contributes server-side: claimed facts are
  spot-checked against matching chunks (the server searches and returns pass/fail plus
  citations, not text), and every summary passes the guardian's n-gram overlap check
  against the **full corpus and wiki** before it's accepted. `entries` (original prose +
  citations) is committable; its sources are not.
- **Retrieval** (`server/retrieval.py`): SQLite FTS5 search + relation-graph walk.
  `retrieve(query, k, max_spoiler_tier)` returns the rows every prompt is grounded in —
  drawn from `entries` and cached wiki text only, never `book_chunks`.
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
3. **N-gram overlap** vs. the full book corpus and cached wiki text, **in both
   directions**: every generated artifact on the way in, and — as a tripwire that the
   text boundary holds — every outgoing prompt before it reaches `claude_harness.py`.
   A prompt that trips the check is a *bug* (some code path leaked chunk text), so it
   fails loudly rather than regenerating.

Fail → regenerate once with the guardian's feedback appended; fail again → fall back to
canned content and log it. The game never blocks on a stubborn generation.

### 2.6 Front end (`web/`)
Stays no-build vanilla JS; becomes a thin client.

- `app.js`: add a tiny `api.js` (fetch wrapper + SSE listener), a conversation panel
  (character portrait line, streamed reply text, choice buttons, free-text input), and
  "the world is thinking" states for generation latency.
- **Quote panel**: codex entries grow a "*from the text*" section — the actual cited
  passage(s), fetched from `book_chunks` by id and rendered verbatim below the original
  summary. Also a codex search box that hits `find_quotes` directly, so the player can
  hunt for a half-remembered scene. Server-rendered from local disk only; if the game is
  ever hosted beyond localhost, this panel is the first thing that must be owner-gated
  (§5 rule 5).
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
- Chunk indexing: FTS5 + embeddings from a local model (one-time ingest pass);
  `find_quotes` hybrid search returning references + citations only, and
  `get_chunk_text` restricted to quote-panel and guardian callers.
- Wiki ingest with caching + rate limiting; `ATTRIBUTION.md` generation.
- Entry pipeline (wiki + model knowledge in, original prose out) with server-side
  fact-spot-check against chunks; two-sided n-gram checker (artifacts in, prompts out);
  FTS5 retrieval over entries; spoiler tiers.
- Exit: `retrieve("d'ivers", 5, tier=4)` returns clean, cited, original-prose rows;
  `find_quotes("the scene where the Chain of Dogs ends", 3, tier=4)` returns the right
  chunk refs and `get_chunk_text` renders the real passage; spot-check 20 entries by
  hand; a deliberately chunk-text-stuffed prompt trips the outbound n-gram check;
  verify `git status` shows no corpus files.

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
lore/            ingest.py, books/ (PRIVATE, gitignored), raw/ (gitignored),
                 corpus.db (chunks+embeddings, gitignored), lore.db (entries,
                 committable), ATTRIBUTION.md
world/           world.db, saves/, telemetry.jsonl   (gitignored except .gitkeep)
web/             thin client (existing files, evolved)
docs/            this plan
```

## 5. Lore-fidelity rules (restated, they govern everything)

1. Prompts are **grounded**: no generation call goes out without retrieved lore rows.
2. Output is **checked**: schema → guardian → (where possible) n-gram overlap.
3. Knowledge is **bounded**: spoiler tiers cap what the world and its characters know.
4. Generated prose is **original** and the model is **blind to the books**: everything
   Claude writes is paraphrase-with-citation, and no prompt ever contains book text —
   the model finds passages by reference (§2.2), so it *cannot* quote what it never saw.
   Both directions are n-gram-enforced: outgoing prompts as a boundary tripwire,
   incoming artifacts before they enter the world.
5. Sources are **contained**: the book corpus, its embeddings, and the raw wiki cache
   are gitignored and never leave this machine — embeddings are computed by a local
   model, never a hosted API. The public repo only ever contains original-paraphrase
   entries and code. Verbatim quotes appear in exactly one place: rendered locally to
   the owner from their own copies (the quote panel). That feature is inherently
   personal-use; if the game is ever shared/hosted beyond personal use, the quote panel
   gets owner-gated or removed first, and this section gets revisited.
6. The project stays **non-commercial** personal fan work.

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Max-subscription rate limits (5-hour windows) during heavy play | Model tiering: small model (haiku) for chatter/guardian n-gram triage, mid/large only for GM world-gen and pivotal dialogue; aggressive one-step-ahead caching; telemetry so you can see burn rate; graceful "the world holds its breath" UI state when throttled. |
| Generation latency breaks immersion | SSE streaming, pregeneration, choices render instantly from the last turn while free-text goes live. |
| `claude` CLI flag/behavior drift across versions | All invocations behind `claude_harness.py`; smoke test in CI-ish `dev.sh`; pin expectations in one place. |
| Resumed sessions dying mid-conversation | Dossier+memory rebuild is the primary mechanism; `--resume` is only an optimization. |
| Lore drift / hallucinated canon | Grounded prompts + guardian gate + knowledge boundaries; guardian failures fall back to canned content rather than shipping errors. |
| Book text leaking into the public repo | `lore/books/`, `lore/raw/`, and `lore/corpus.db` (chunks + embeddings) are gitignored from day one — source text and committable `entries` never share a database; a pre-commit check greps staged files for corpus paths; paraphrase `entries` are the only committable lore artifact. |
| Game output reproducing novel prose | The model never receives book text (structural prevention, not just detection); guardian n-gram check still runs against the full local corpus on every generated artifact as a backstop; characters prompted to speak in their own voice. |
| Fidelity loss from generating without book excerpts | Ground on wiki + entries + Claude's strong training knowledge of the series; server-side fact spot-checks against chunks (pass/fail + citations back to the model); guardian lore gate catches contradictions. Accepted trade: some prose-texture mimicry is lost — which the never-quote rule suppressed anyway. |
| Local embedding model quality/speed on the Mac | Small sentence-transformers models run fine on CPU/MPS at ~15–20k chunks; hybrid FTS5+vector search covers keyword misses; ingest is one-time so embedding cost is paid once. |
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
