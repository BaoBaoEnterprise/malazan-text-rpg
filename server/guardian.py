"""Guardian pipeline — Phase 1 scope: the n-gram overlap gate, two-sided
(plan §2.5). The lore-contradiction model gate arrives with Phase 2.

- check_artifact(text): generated content on its way INTO the world. Overlap
  with the corpus/wiki means the model reproduced source prose -> reject so
  the caller can regenerate.
- check_prompt(text): outgoing prompts. Overlap here means some code path
  leaked raw chunk text into a prompt — that is a BUG in the text boundary,
  so it raises instead of returning; callers must not catch-and-retry.

Both compare normalized 8-word shingles against corpus.db's ngram index
(books) plus any cached wiki pages. If no corpus exists on this machine the
checks run against whatever sources are present (possibly none) — check()
reports which sources were loaded so callers can log degraded coverage.
"""

import json
from pathlib import Path

from lore.db import CORPUS_DB
from lore.ingest import NGRAM_N, ngram_hashes, normalize_words

WIKI_CACHE = Path(__file__).resolve().parent.parent / 'lore' / 'raw'


class BoundaryViolation(Exception):
    """Raw source text was found in an outgoing prompt. This is a bug."""


class NgramIndex:
    def __init__(self, corpus_db=None, wiki_cache=None):
        self.sources = []
        self._book_hashes = None
        self._wiki_hashes = set()

        db_path = Path(corpus_db) if corpus_db else CORPUS_DB
        if db_path.exists():
            import sqlite3
            self._con = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
            self.sources.append('books')
        else:
            self._con = None

        cache = Path(wiki_cache) if wiki_cache else WIKI_CACHE
        if cache.is_dir():
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


def check_artifact(text, index=None):
    """-> {'ok': bool, 'spans': [...], 'sources': [...]} for generated content."""
    index = index or NgramIndex()
    spans = index.overlapping_spans(text)
    return {'ok': not spans, 'spans': spans, 'sources': index.sources}


def check_prompt(text, index=None):
    """Raise BoundaryViolation if source text appears in an outgoing prompt."""
    index = index or NgramIndex()
    spans = index.overlapping_spans(text)
    if spans:
        raise BoundaryViolation(
            f'outgoing prompt contains {len(spans)} source n-gram(s); '
            f'first: {spans[0]!r} — a code path is leaking chunk text into '
            'prompts. Fix the leak; do not retry around this.')


def _hash(gram):
    import hashlib
    return int.from_bytes(hashlib.sha1(gram.encode()).digest()[:8], 'big') - 2 ** 63
