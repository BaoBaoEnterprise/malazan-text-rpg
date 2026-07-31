"""Game Master server — FastAPI app.

Phase 0: health endpoint + serves the existing web/ client. Later phases add
/api/session, world state, and character conversation endpoints.

Run via ./dev.sh, or directly:
    uvicorn server.app:app --reload --port 8000
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from . import claude_harness

ROOT = Path(__file__).resolve().parent.parent

app = FastAPI(title='The Barrows of Morn — Game Master')


@app.get('/api/health')
def health():
    return {
        'ok': True,
        'phase': 0,
        'claude': claude_harness.availability(),
    }


# Mounted last so /api/* wins; html=True serves index.html at /.
app.mount('/', StaticFiles(directory=ROOT / 'web', html=True), name='web')
