"""Guardian pipeline — Phase 1 scope: the n-gram overlap gate, two-sided
(plan §2.5). The lore-contradiction model gate arrives with Phase 2.

- check_artifact(text): generated content on its way INTO the world. Overlap
  with the corpus/wiki means the model reproduced source prose -> reject so
  the caller can regenerate.
- check_prompt(text): outgoing prompts. Overlap here means some code path
  leaked raw chunk text into a prompt — that is a BUG in the text boundary,
  so it raises instead of returning; callers must not catch-and-retry.

The two checks use DIFFERENT source sets. Wiki text is *allowed* in prompts
by design (plan §2.2 grounds entry generation on it), so check_prompt guards
book chunks only — prompt_index(). check_artifact guards books AND wiki,
since generated content must copy neither — artifact_index(). If no corpus
exists on this machine the checks run against whatever sources are present
(possibly none); results report which sources were loaded so callers can log
degraded coverage.
"""

import json
import urllib.parse
from pathlib import Path

from lore.db import CORPUS_DB
from lore.ingest import NGRAM_N, ngram_hashes, normalize_words

WIKI_CACHE = Path(__file__).resolve().parent.parent / 'lore' / 'raw'


class BoundaryViolation(Exception):
    """Raw source text was found in an outgoing prompt. This is a bug."""


class NgramIndex:
    def __init__(self, corpus_db=None, wiki_cache=None, include_wiki=True):
        self.sources = []
        self._wiki_hashes = set()

        db_path = Path(corpus_db) if corpus_db else CORPUS_DB
        if db_path.exists():
            import sqlite3
            uri = f'file:{urllib.parse.quote(str(db_path))}?mode=ro'
            self._con = sqlite3.connect(uri, uri=True)
            self.sources.append('books')
        else:
            self._con = None

        cache = Path(wiki_cache) if wiki_cache else WIKI_CACHE
        if include_wiki and cache.is_dir():
            pages = list(cache.glob('*.json'))
            for p in pages:
                text = json.loads(p.read_text()).get('extract', '')
                self._wiki_hashes |= ngram_hashes(text)
            if pages:
                self.sources.append('wiki')

    def overlapping_spans(self, text, n=NGRAM_N):
        """Return the list of n-word spans of `text` found in any source."""
        words = normalize_words(text)
        hits = []
        for i in range(len(words) - n + 1):
            gram = ' '.join(words[i:i + n])
            h = _hash(gram)
            if h in self._wiki_hashes or self._in_books(h):
                hits.append(gram)
        return hits

    def _in_books(self, h):
        if self._con is None:
            return False
        row = self._con.execute(
            'SELECT 1 FROM ngrams WHERE h = ?', (h,)).fetchone()
        return row is not None


def prompt_index(corpus_db=None):
    """Books-only index for the outgoing-prompt tripwire. Cheap to build
    (one sqlite open, no wiki load) — safe to create per call, which also
    keeps it fresh after an ingest and thread-safe under FastAPI's pool."""
    return NgramIndex(corpus_db=corpus_db, include_wiki=False)


def artifact_index(corpus_db=None, wiki_cache=None):
    """Books + wiki index for vetting generated content."""
    return NgramIndex(corpus_db=corpus_db, wiki_cache=wiki_cache)


def check_artifact(text, index=None):
    """-> {'ok': bool, 'spans': [...], 'sources': [...]} for generated content.
    Checks against books AND wiki: generated prose may copy neither."""
    index = index or artifact_index()
    spans = index.overlapping_spans(text)
    return {'ok': not spans, 'spans': spans, 'sources': index.sources}


def check_prompt(text, index=None):
    """Raise BoundaryViolation if BOOK text appears in an outgoing prompt.
    Wiki text is legitimate prompt grounding and is not checked here."""
    index = index or prompt_index()
    spans = index.overlapping_spans(text)
    if spans:
        raise BoundaryViolation(
            f'outgoing prompt contains {len(spans)} source n-gram(s); '
            f'first: {spans[0]!r} — a code path is leaking chunk text into '
            'prompts. Fix the leak; do not retry around this.')


def _hash(gram):
    import hashlib
    return int.from_bytes(hashlib.sha1(gram.encode()).digest()[:8], 'big') - 2 ** 63
