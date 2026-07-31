"""Phase 1 exit-criteria tests, run against a synthetic stand-in corpus.

The 'books' here are original text written for this test suite — the real
corpus only ever exists on the owner's machine. These tests prove the
machinery: ingest, reference-only quote search, the raw-text gate, the
two-sided n-gram guardian, and entry storage/retrieval.
"""

import json

import pytest

from lore import embed
from lore.db import build_lore_db, validate_entry
from lore.ingest import chunk_text, ingest_dir, ngram_hashes
from lore.wiki import get_page, write_attribution
from server import claude_harness, guardian, retrieval

BOOK_ONE = """Chapter 1

The gulls turned above the harbor of Pale Reach while the tide dragged its
slow grey nets across the flats. Sergeant Varra counted lanterns on the mole
and found one missing, which in her experience meant either a thief or a
storm, and the sky was clear.

The fisherfolk hauled their catch past the tollhouse in silence. Nobody
looked at the soldiers. Nobody ever did, until they needed them.

Chapter 2

In the barrow field north of the town the digging crews broke their shovels
on stone that was not stone. Varra stood at the pit edge and watched the
foreman turn a shard over in his hands, the way a man turns a coin he
suspects is cursed.

By nightfall three diggers had deserted and the shard sat wrapped in wool in
the tollhouse cellar, humming to itself in a language of cold.
"""

BOOK_TWO = """Chapter 1

The march south from Pale Reach took the company through orchards burned in
some older war, rows of black trees like script on a page nobody could read
anymore. Varra rode at the column's head and did not look back.

Chapter 2

At the ford the river ran shallow over red gravel, and on the far bank a
lone figure waited, leaning on a spear of bone. The company halted without
being ordered to. Some things a body understands before the mind consents.

The figure named itself Ethrin of the Broken Hill, and asked, politely, who
among them carried the shard of cold. No one answered. The river answered,
freezing bank to bank in the space of a breath.
"""

GOOD_ENTRY = {
    'slug': 'test_subject', 'type': 'character', 'title': 'Test Subject',
    'summary': 'An entirely original figure invented for the test suite, '
               'known for validating retrieval paths and nothing else.',
    'relations': {}, 'spoiler_tier': 2,
    'citations': [{'book': 'Stand-In Book One', 'chapter': 'Chapter 2'}],
    'sources': ['model'],
}


@pytest.fixture(scope='module')
def corpus(tmp_path_factory):
    root = tmp_path_factory.mktemp('standin')
    books = root / 'books'
    books.mkdir()
    (books / '01 Stand-In Book One.txt').write_text(BOOK_ONE)
    (books / '02 Stand-In Book Two.txt').write_text(BOOK_TWO)
    db = root / 'corpus.db'
    ingest_dir(books, corpus_db=db, embedder=embed.HashingEmbedder(),
               progress=lambda *a: None)
    return db


def test_chunking_tracks_chapters():
    chunks = list(chunk_text(BOOK_ONE))
    assert chunks
    assert {c for c, _ in chunks} == {'Chapter 1', 'Chapter 2'}


def test_find_quotes_returns_references_never_text(corpus):
    refs = retrieval.find_quotes('the shard humming in the cellar', k=3,
                                 corpus_db=corpus)
    assert refs
    assert refs[0]['book'] == 'Stand-In Book One'
    for r in refs:
        assert set(r) == {'chunk_id', 'book', 'chapter', 'score'}


def test_find_quotes_respects_spoiler_tier(corpus):
    refs = retrieval.find_quotes('Ethrin of the Broken Hill', k=5,
                                 max_spoiler_tier=1, corpus_db=corpus)
    assert all(r['book'] != 'Stand-In Book Two' for r in refs)


def test_get_chunk_text_gated_by_purpose(corpus):
    ref = retrieval.find_quotes('lanterns on the mole', k=1, corpus_db=corpus)[0]
    with pytest.raises(PermissionError):
        retrieval.get_chunk_text(ref['chunk_id'], purpose='prompt',
                                 corpus_db=corpus)
    got = retrieval.get_chunk_text(ref['chunk_id'], purpose='quote_panel',
                                   corpus_db=corpus)
    assert 'lanterns' in got['text']
    assert got['book'] == 'Stand-In Book One'


def test_guardian_flags_copied_prose(corpus):
    index = guardian.NgramIndex(corpus_db=corpus, wiki_cache='/nonexistent')
    copied = ('He stood at the pit edge and watched the foreman turn a shard '
              'over in his hands, the way a man turns a coin he suspects is '
              'cursed, or so the story went.')
    assert not guardian.check_artifact(copied, index)['ok']
    original = ('A sergeant of Pale Reach grew suspicious when an excavated '
                'relic radiated unnatural cold, and hid it beneath the town.')
    assert guardian.check_artifact(original, index)['ok']


def test_prompt_tripwire_blocks_before_subprocess(corpus, monkeypatch):
    index = guardian.NgramIndex(corpus_db=corpus, wiki_cache='/nonexistent')
    monkeypatch.setattr(claude_harness, '_boundary_index', index)

    def no_subprocess(*a, **k):
        raise AssertionError('prompt with source text reached the CLI')
    monkeypatch.setattr(claude_harness.subprocess, 'run', no_subprocess)

    leaked = 'Summarize this: ' + BOOK_ONE[200:420]
    with pytest.raises(guardian.BoundaryViolation):
        claude_harness.run_stateless(leaked, role='test')
    # Clean prompts still reach the (stubbed) subprocess layer.
    with pytest.raises(AssertionError, match='reached the CLI'):
        claude_harness.run_stateless('Describe an original wind-swept moor.',
                                     role='test')


def test_ngram_hashing_is_order_sensitive():
    a = ngram_hashes('one two three four five six seven eight')
    b = ngram_hashes('eight seven six five four three two one')
    assert a and b and a != b


def test_entries_build_and_retrieve(tmp_path):
    entries = tmp_path / 'entries.jsonl'
    second = dict(GOOD_ENTRY, slug='other_subject', title='Other Subject',
                  spoiler_tier=5,
                  summary='A different invented figure who appears only in '
                          'later stand-in volumes of the test corpus.')
    entries.write_text(json.dumps(GOOD_ENTRY) + '\n' + json.dumps(second) + '\n')
    db = tmp_path / 'lore.db'
    assert build_lore_db(entries, db) == 2

    rows = retrieval.retrieve('invented figure', k=5, lore_db=db)
    assert {r['slug'] for r in rows} == {'test_subject', 'other_subject'}
    rows = retrieval.retrieve('invented figure', k=5, max_spoiler_tier=2,
                              lore_db=db)
    assert {r['slug'] for r in rows} == {'test_subject'}
    assert rows[0]['citations'][0]['book'] == 'Stand-In Book One'


def test_validate_entry_rejects_bad_rows():
    for corrupt in (
        {**GOOD_ENTRY, 'type': 'god'},
        {**GOOD_ENTRY, 'spoiler_tier': 0},
        {**GOOD_ENTRY, 'citations': []},
        {k: v for k, v in GOOD_ENTRY.items() if k != 'summary'},
    ):
        with pytest.raises(ValueError):
            validate_entry(corrupt)


def test_fts_query_survives_hostile_input(corpus):
    assert retrieval.find_quotes('"shard AND (cellar', k=2,
                                 corpus_db=corpus) is not None


def test_wiki_cache_and_attribution(tmp_path):
    raw = tmp_path / 'raw'
    raw.mkdir()
    (raw / 'sample_page.json').write_text(json.dumps({
        'title': 'Sample Page', 'extract': 'Cached fixture text.',
        'url': 'https://malazan.fandom.com/wiki/Sample_Page',
        'fetched_at': '2026-07-31'}))
    page = get_page('Sample Page', raw_dir=raw, fetch=False)
    assert page['extract'] == 'Cached fixture text.'
    assert get_page('Missing Page', raw_dir=raw, fetch=False) is None

    out = tmp_path / 'ATTRIBUTION.md'
    assert write_attribution(raw, out) == 1
    assert 'Sample Page' in out.read_text()


def test_guardian_catches_wiki_overlap(tmp_path):
    raw = tmp_path / 'raw'
    raw.mkdir()
    wiki_text = ('The fortress of invented examples stood upon a cliff of '
                 'entirely fictional basalt above a sea of test data.')
    (raw / 'fortress.json').write_text(json.dumps({
        'title': 'Fortress', 'extract': wiki_text, 'url': 'x',
        'fetched_at': '2026-07-31'}))
    index = guardian.NgramIndex(corpus_db='/nonexistent', wiki_cache=raw)
    assert index.sources == ['wiki']
    assert not guardian.check_artifact(
        'As the wiki says, the fortress of invented examples stood upon a '
        'cliff of entirely fictional basalt.', index)['ok']
