"""Lore retrieval (plan §2.2).

Two very different callers, two very different contracts:

- retrieve():     prompt-facing. Returns entry rows (original paraphrase +
                  citations) from lore.db. This is the ONLY lore that may be
                  put in front of the model.
- find_quotes():  reference-facing. Hybrid search over the private corpus;
                  returns chunk ids + citations + scores, NEVER text.
- get_chunk_text(): the sole raw-text accessor. Restricted by `purpose` to
                  the quote panel and the guardian; every call is an audit
                  event. The real boundary enforcement is guardian.check_prompt
                  on every outgoing prompt — this gate is the audit trail.
"""

import json

from lore import embed
from lore.db import open_corpus, open_lore

QUOTE_PURPOSES = ('quote_panel', 'guardian')


def retrieve(query, k=5, max_spoiler_tier=10, lore_db=None):
    """Prompt-grounding rows from entries. Safe to place in prompts."""
    con = open_lore(lore_db)
    rows = con.execute(
        'SELECT e.slug, e.type, e.title, e.summary, e.spoiler_tier,'
        '       e.citations, e.sources'
        ' FROM entries_fts f JOIN entries e ON e.id = f.rowid'
        ' WHERE entries_fts MATCH ? AND e.spoiler_tier <= ?'
        ' ORDER BY rank LIMIT ?',
        (_fts_query(query), max_spoiler_tier, k)).fetchall()
    return [dict(r, citations=json.loads(r['citations']),
                 sources=json.loads(r['sources'])) for r in rows]


def find_quotes(query, k=3, max_spoiler_tier=10, corpus_db=None):
    """Locate passages in the private corpus. Returns references only:
    [{chunk_id, book, chapter, score}] — no text field, by design."""
    con = open_corpus(corpus_db)
    embedder = embed.by_name(
        con.execute("SELECT value FROM meta WHERE key='embedder'").fetchone()[0])

    fts_rank = {}
    rows = con.execute(
        'SELECT c.id FROM chunks_fts f JOIN book_chunks c ON c.id = f.rowid'
        ' WHERE chunks_fts MATCH ? AND c.book_no <= ? ORDER BY rank LIMIT 50',
        (_fts_query(query), max_spoiler_tier)).fetchall()
    for pos, r in enumerate(rows):
        fts_rank[r['id']] = pos

    qvec = embedder.embed([query])[0]
    sims = []
    for r in con.execute(
            'SELECT v.chunk_id, v.vector FROM chunk_vectors v'
            ' JOIN book_chunks c ON c.id = v.chunk_id WHERE c.book_no <= ?',
            (max_spoiler_tier,)):
        sims.append((embed.cosine(qvec, json.loads(r['vector'])), r['chunk_id']))
    sims.sort(reverse=True)
    vec_rank = {cid: pos for pos, (_, cid) in enumerate(sims[:50])}

    # Reciprocal-rank fusion of the two result lists.
    fused = {}
    for cid in set(fts_rank) | set(vec_rank):
        fused[cid] = (1.0 / (60 + fts_rank.get(cid, 999))
                      + 1.0 / (60 + vec_rank.get(cid, 999)))
    top = sorted(fused, key=fused.get, reverse=True)[:k]

    out = []
    for cid in top:
        c = con.execute(
            'SELECT id, book, chapter FROM book_chunks WHERE id = ?',
            (cid,)).fetchone()
        out.append({'chunk_id': c['id'], 'book': c['book'],
                    'chapter': c['chapter'], 'score': round(fused[cid], 5)})
    return out


def get_chunk_text(chunk_id, purpose, corpus_db=None):
    """Fetch raw passage text — quote panel and guardian ONLY (plan §2.2).
    Never call this while assembling a prompt; guardian.check_prompt will
    catch it if you do."""
    if purpose not in QUOTE_PURPOSES:
        raise PermissionError(
            f'get_chunk_text purpose {purpose!r} not in {QUOTE_PURPOSES} — '
            'raw book text is only for local display and checking')
    con = open_corpus(corpus_db)
    row = con.execute(
        'SELECT book, book_no, chapter, text FROM book_chunks WHERE id = ?',
        (chunk_id,)).fetchone()
    if row is None:
        raise KeyError(f'no chunk {chunk_id}')
    _audit(chunk_id, purpose)
    return {'chunk_id': chunk_id, 'book': row['book'], 'book_no': row['book_no'],
            'chapter': row['chapter'], 'text': row['text']}


def _audit(chunk_id, purpose):
    import time
    from server.claude_harness import TELEMETRY_PATH
    try:
        TELEMETRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TELEMETRY_PATH, 'a') as f:
            f.write(json.dumps({
                'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'event': 'chunk_text_access', 'chunk_id': chunk_id,
                'purpose': purpose}) + '\n')
    except OSError:
        pass


def _fts_query(query):
    """Quote each term so user phrasing can't inject FTS5 syntax."""
    terms = [t for t in ''.join(
        c if c.isalnum() or c in "'’" else ' ' for c in query).split() if t]
    return ' OR '.join(f'"{t}"' for t in terms) or '""'
