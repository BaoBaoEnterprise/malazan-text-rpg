#!/usr/bin/env bash
# Start the Game Master server (and serve web/) for local development.
#   ./dev.sh          — install deps into .venv if needed, run on :8000
#   ./dev.sh smoke    — also run the claude round-trip smoke test first
set -euo pipefail
cd "$(dirname "$0")"

# Corpus-path guard (blocks committing book files even with git add -f).
git config core.hooksPath .githooks 2>/dev/null || true

if [ ! -d .venv ]; then
  echo "Creating virtualenv..."
  python3 -m venv .venv
fi
# shellcheck disable=SC1091
source .venv/bin/activate
pip install -q -r server/requirements.txt

if [ "${1:-}" = "smoke" ]; then
  python -m server.smoke
fi

echo "Serving game + API on http://localhost:8000 (health: /api/health)"
exec uvicorn server.app:app --reload --port 8000
