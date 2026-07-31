"""SQLite schemas and connections for the two lore stores (plan §2.2).

corpus.db (PRIVATE, gitignored): book_chunks + vectors + ngrams.
lore.db (built, gitignored):     entries + FTS index, compiled from the
                                 committed lore/entries.jsonl.
"""

import json
import sqlite3
from pathlib import Path

LORE_DIR = Path(__file__).resolve().parent
CORPUS_DB = LORE_DIR / 'corpus.db'
LORE_DB = LORE_DIR / 'lore.db'
ENTRIES_JSONL = LORE_DIR / 'entries.jsonl'

ENTRY_TYPES = ('character', 'race', 'warren', 'place', 'event', 'item', 'faction')

CORPUS_SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS book_chunks (
  id INTEGER PRIMARY KEY,
  book TEXT NOT NULL,          -- human title, e.g. 'Deadhouse Gates'
  book_no INTEGER NOT NULL,    -- 1..10 reading order = spoiler tier
  chapter TEXT,                -- 'Chapter 7', 'Prologue', ...
  seq INTEGER NOT NULL,        -- chunk order within the book
  text TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  text, content='book_chunks', content_rowid='id'
);
CREATE TABLE IF NOT EXISTS chunk_vectors (
  chunk_id INTEGER PRIMARY KEY REFERENCES book_chunks(id),
  vector TEXT NOT NULL         -- JSON array of floats
);
CREATE TABLE IF NOT EXISTS ngrams (h INTEGER PRIMARY KEY) WITHOUT ROWID;
"""

LORE_SCHEMA = """
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,       -- ORIGINAL paraphrase, never source text
  relations TEXT NOT NULL,     -- JSON
  spoiler_tier INTEGER NOT NULL,
  citations TEXT NOT NULL,     -- JSON [{book, chapter?}]
  sources TEXT NOT NULL        -- JSON e.g. ["wiki:Anomander Rake", "model"]
);
CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  title, summary, content='entries', content_rowid='id'
);
"""


def open_corpus(path=None, create=False):
    p = Path(path) if path else CORPUS_DB
    if not create and not p.exists():
        raise FileNotFoundError(
            f'{p} not found — the book corpus has not been ingested on this '
            'machine (run: python -m lore.ingest <books_dir>)')
    con = sqlite3.connect(p)
    con.row_factory = sqlite3.Row
    con.executescript(CORPUS_SCHEMA)
    return con


def open_lore(path=None, create=False):
    p = Path(path) if path else LORE_DB
    if not create and not p.exists():
        raise FileNotFoundError(
            f'{p} not found — build it with: python -m lore.entries build')
    con = sqlite3.connect(p)
    con.row_factory = sqlite3.Row
    con.executescript(LORE_SCHEMA)
    return con


def build_lore_db(entries_path=None, db_path=None):
    """Compile committed entries.jsonl -> lore.db (idempotent, full rebuild)."""
    src = Path(entries_path) if entries_path else ENTRIES_JSONL
    dst = Path(db_path) if db_path else LORE_DB
    if dst.exists():
        dst.unlink()
    con = open_lore(dst, create=True)
    n = 0
    with open(src) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            e = json.loads(line)
            validate_entry(e)
            cur = con.execute(
                'INSERT INTO entries (slug, type, title, summary, relations,'
                ' spoiler_tier, citations, sources) VALUES (?,?,?,?,?,?,?,?)',
                (e['slug'], e['type'], e['title'], e['summary'],
                 json.dumps(e.get('relations', {})), e['spoiler_tier'],
                 json.dumps(e['citations']), json.dumps(e['sources'])))
            con.execute(
                'INSERT INTO entries_fts (rowid, title, summary) VALUES (?,?,?)',
                (cur.lastrowid, e['title'], e['summary']))
            n += 1
    con.commit()
    return n


def validate_entry(e):
    for key in ('slug', 'type', 'title', 'summary', 'spoiler_tier', 'citations',
                'sources'):
        if key not in e:
            raise ValueError(f'entry missing {key!r}: {e.get("slug", e)}')
    if e['type'] not in ENTRY_TYPES:
        raise ValueError(f"entry {e['slug']}: bad type {e['type']!r}")
    if not isinstance(e['spoiler_tier'], int) or not 1 <= e['spoiler_tier'] <= 10:
        raise ValueError(f"entry {e['slug']}: spoiler_tier must be int 1..10")
    if not isinstance(e['citations'], list) or not e['citations']:
        raise ValueError(f"entry {e['slug']}: citations must be a non-empty list")
    for c in e['citations']:
        if 'book' not in c:
            raise ValueError(f"entry {e['slug']}: citation missing 'book'")
