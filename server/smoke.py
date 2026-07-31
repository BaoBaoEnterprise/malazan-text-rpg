"""Smoke test: one real `claude -p` JSON round-trip through the harness.

    python -m server.smoke

Exit 0 = harness works end-to-end. Exit 1 = CLI missing/broken or the
round-trip failed; the reason is printed.
"""

import sys

from . import claude_harness


def main():
    avail = claude_harness.availability()
    if not avail.get('installed') or avail.get('error'):
        print(f'FAIL: claude CLI unavailable: {avail}')
        return 1
    print(f"claude CLI: {avail.get('version')} at {avail.get('path')}")

    try:
        result = claude_harness.run_stateless(
            'Reply with ONLY this JSON object, no other text: '
            '{"pong": true, "speaker": "<name any Malazan character>"}',
            system_prompt='You are a smoke test. Reply with only valid JSON.',
            timeout=90,
            role='smoke',
        )
    except claude_harness.HarnessError as e:
        print(f'FAIL: round-trip failed: {e}')
        return 1

    if result.get('pong') is not True:
        print(f'FAIL: unexpected payload: {result}')
        return 1

    print(f'OK: round-trip succeeded: {result}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
