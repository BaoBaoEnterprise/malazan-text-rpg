"""Lore database tooling (Living World plan §2.2).

Two stores with a hard boundary between them:

- lore/corpus.db   PRIVATE, gitignored. Book chunks, their embeddings, and the
                   n-gram index. Built once on the owner's machine by
                   `python -m lore.ingest <books_dir>`. Raw chunk text is only
                   ever read by the quote panel and the guardian — never by
                   prompt-building code.
- lore/lore.db     Built artifact (gitignored) compiled from lore/entries.jsonl,
                   which IS committed: original-paraphrase entries with
                   citations. This is the only lore that may appear in prompts.

Embeddings come from a local model. On the Mac: `pip install fastembed` (ONNX,
CPU). Without it, ingest and search fall back to a deterministic hashing
embedder — fine for tests and keyword-ish search, no real semantics.
"""
