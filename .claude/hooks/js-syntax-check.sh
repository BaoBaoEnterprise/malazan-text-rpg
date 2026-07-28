#!/usr/bin/env bash
# js-syntax-check.sh — PostToolUse hook.
# When Claude edits a web JS file, run `node --check` on it so a syntax error is
# caught immediately (exit 2 feeds the error back to Claude to fix). No-ops for
# any other file, and silently skips if node isn't installed.
set -euo pipefail

input="$(cat)"

# Pull tool_input.file_path out of the hook's JSON payload (python3 ships on macOS).
file="$(printf '%s' "$input" | python3 -c \
  'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' \
  2>/dev/null || true)"

case "$file" in
  *web/*.js|*web/src/*.js) ;;   # a game JS file — check it
  *) exit 0 ;;                  # anything else — nothing to do
esac

command -v node >/dev/null 2>&1 || exit 0   # no node → skip quietly
[ -f "$file" ] || exit 0

if ! out="$(node --check "$file" 2>&1)"; then
  {
    echo "JavaScript syntax error introduced in $file — fix before continuing:"
    echo "$out"
  } >&2
  exit 2
fi

exit 0
