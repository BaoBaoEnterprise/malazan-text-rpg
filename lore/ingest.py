"""Book-corpus ingest: chunk owner-supplied novels into corpus.db.

    python -m lore.ingest <books_dir> [--corpus-db PATH]

<books_dir> holds DRM-free .txt or .epub files, one per novel, named with a
reading-order prefix that becomes the spoiler tier:

    01 Gardens of the Moon.epub
    02 Deadhouse Gates.txt
    ...

Everything this module writes is gitignored (plan §5 rule 5). Runs entirely
locally: chunking, n-gram indexing, and embedding (local model only).
"""

import argparse
import hashlib
import html.parser
import re
import sys
import zipfile
from pathlib import Path

from . import embed
from .db import open_corpus

CHUNK_WORDS = 300
NGRAM_N = 8

CHAPTER_RE = re.compile(
    r'^\s*(chapter\s+[\w-]+|prologue|epilogue|book\s+[\w-]+)\s*$', re.I)


def ingest_dir(books_dir, corpus_db=None, embedder=None, progress=print):
    books_dir = Path(books_dir)
    files = sorted(p for p in books_dir.iterdir()
                   if p.suffix.lower() in ('.txt', '.epub'))
    if not files:
        raise SystemExit(f'no .txt or .epub files in {books_dir}')

    embedder = embedder or embed.best_available()
    con = open_corpus(corpus_db, create=True)
    con.execute('DELETE FROM book_chunks')
    con.execute('DELETE FROM chunks_fts')
    con.execute('DELETE FROM chunk_vectors')
    con.execute('DELETE FROM ngrams')
    con.execute('INSERT OR REPLACE INTO meta VALUES (?, ?)',
                ('embedder', embedder.name))

    total = 0
    for path in files:
        book_no, title = _book_meta(path)
        text = _read_epub(path) if path.suffix.lower() == '.epub' else \
            path.read_text(errors='replace')
        chunks = list(chunk_text(text))
        progress(f'{title!r} (book {book_no}): {len(chunks)} chunks')
        vectors = embedder.embed([c for _, c in chunks])
        for seq, ((chapter, chunk), vec) in enumerate(zip(chunks, vectors)):
            cur = con.execute(
                'INSERT INTO book_chunks (book, book_no, chapter, seq, text)'
                ' VALUES (?,?,?,?,?)', (title, book_no, chapter, seq, chunk))
            con.execute('INSERT INTO chunks_fts (rowid, text) VALUES (?,?)',
                        (cur.lastrowid, chunk))
            con.execute('INSERT INTO chunk_vectors VALUES (?,?)',
                        (cur.lastrowid, _vec_json(vec)))
            con.executemany('INSERT OR IGNORE INTO ngrams VALUES (?)',
                            [(h,) for h in ngram_hashes(chunk)])
            total += 1
    con.commit()
    con.close()
    progress(f'ingested {total} chunks from {len(files)} books')
    return total


def chunk_text(text):
    """Yield (chapter, chunk_text) pieces of ~CHUNK_WORDS words, splitting on
    paragraphs and tracking chapter headings."""
    chapter = None
    buf, buf_words = [], 0
    for para in re.split(r'\n\s*\n', text):
        para = para.strip()
        if not para:
            continue
        if CHAPTER_RE.match(para):
            if buf:
                yield chapter, '\n\n'.join(buf)
                buf, buf_words = [], 0
            chapter = re.sub(r'\s+', ' ', para).title()
            continue
        buf.append(para)
        buf_words += len(para.split())
        if buf_words >= CHUNK_WORDS:
            yield chapter, '\n\n'.join(buf)
            buf, buf_words = [], 0
    if buf:
        yield chapter, '\n\n'.join(buf)


def normalize_words(text):
    """Lowercase word list with punctuation stripped — shared with guardian so
    n-gram hashing is identical on both sides."""
    return ''.join(
        c.lower() if c.isalnum() or c.isspace() else ' ' for c in text).split()


def ngram_hashes(text, n=NGRAM_N):
    words = normalize_words(text)
    out = set()
    for i in range(len(words) - n + 1):
        gram = ' '.join(words[i:i + n])
        out.add(int.from_bytes(hashlib.sha1(gram.encode()).digest()[:8], 'big')
                - 2 ** 63)
    return out


def _book_meta(path):
    m = re.match(r'^(\d+)[\s_.-]+(.+)$', path.stem)
    if not m:
        raise SystemExit(
            f'{path.name}: name files "<NN> <Title>.txt" so reading order '
            '(= spoiler tier) is explicit')
    return int(m.group(1)), m.group(2).strip()


class _HTMLText(html.parser.HTMLParser):
    SKIP = {'style', 'script', 'head'}
    BLOCK = {'p', 'div', 'h1', 'h2', 'h3', 'h4', 'br', 'li', 'blockquote'}

    def __init__(self):
        super().__init__()
        self.parts = []
        self._skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in self.SKIP:
            self._skip += 1
        elif tag in self.BLOCK:
            self.parts.append('\n\n')

    def handle_endtag(self, tag):
        if tag in self.SKIP and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        if not self._skip:
            self.parts.append(data)


def _read_epub(path):
    """Minimal stdlib EPUB text extraction (zip of xhtml files, spine order
    approximated by name sort — good enough for chunking prose)."""
    out = []
    with zipfile.ZipFile(path) as z:
        names = sorted(n for n in z.namelist()
                       if n.lower().endswith(('.xhtml', '.html', '.htm')))
        for name in names:
            p = _HTMLText()
            p.feed(z.read(name).decode('utf-8', errors='replace'))
            out.append(''.join(p.parts))
    return '\n\n'.join(out)


def _vec_json(vec):
    import json
    return json.dumps([round(v, 6) for v in vec])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('books_dir')
    ap.add_argument('--corpus-db', default=None)
    args = ap.parse_args(argv)
    ingest_dir(args.books_dir, args.corpus_db)


if __name__ == '__main__':
    sys.exit(main())
