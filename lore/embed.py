"""Local embedding backends. Text never leaves the machine to be embedded:
a hosted embedding API is ruled out by plan §5 rule 5.

Backends:
- fastembed (optional pip install, ONNX on CPU/MPS) — real semantics, used on
  the owner's Mac.
- hashing — dependency-free, deterministic char-n-gram hashing. No real
  semantics; exists so ingest/search mechanics are testable anywhere.

corpus.db records which backend produced its vectors; find_quotes refuses to
mix query and corpus vectors from different backends.
"""

import hashlib
import math

HASH_DIM = 256
FASTEMBED_MODEL = 'BAAI/bge-small-en-v1.5'


class HashingEmbedder:
    name = f'hashing-{HASH_DIM}'
    dim = HASH_DIM

    def embed(self, texts):
        return [self._one(t) for t in texts]

    def _one(self, text):
        vec = [0.0] * HASH_DIM
        words = _normalize(text).split()
        for n in (1, 2):
            for i in range(len(words) - n + 1):
                gram = ' '.join(words[i:i + n])
                h = int.from_bytes(hashlib.sha1(gram.encode()).digest()[:8], 'big')
                vec[h % HASH_DIM] += 1.0 if n == 1 else 2.0
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


class FastEmbedEmbedder:
    name = f'fastembed:{FASTEMBED_MODEL}'
    dim = 384

    def __init__(self):
        from fastembed import TextEmbedding  # raises ImportError if not installed
        self._model = TextEmbedding(model_name=FASTEMBED_MODEL)

    def embed(self, texts):
        return [list(map(float, v)) for v in self._model.embed(list(texts))]


def best_available():
    try:
        return FastEmbedEmbedder()
    except ImportError:
        return HashingEmbedder()


def by_name(name):
    """Return the embedder matching a name recorded in corpus.db."""
    if name == HashingEmbedder.name:
        return HashingEmbedder()
    if name == FastEmbedEmbedder.name:
        return FastEmbedEmbedder()
    raise ValueError(f'unknown embedder {name!r} — re-run ingest')


def cosine(a, b):
    num = sum(x * y for x, y in zip(a, b))
    da = math.sqrt(sum(x * x for x in a)) or 1.0
    db = math.sqrt(sum(y * y for y in b)) or 1.0
    return num / (da * db)


def _normalize(text):
    return ''.join(c.lower() if c.isalnum() or c.isspace() else ' ' for c in text)
