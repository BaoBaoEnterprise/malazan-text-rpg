"""Headless Claude invocations for the Game Master server.

Every `claude -p` call in the project goes through this module so CLI-flag
drift is contained in one place (Living World plan §2.1). Two calling modes:

- stateless:      prompt in -> parsed JSON out (guardian checks, world gen)
- conversational: same, but pinned to a session id so a character
                  conversation can continue across calls (`--resume`).
                  Resume is an optimization; callers must be able to rebuild
                  from their own dossier/memory state if it fails.

No tools are ever granted to these sessions (`--allowedTools ""`): the server
does retrieval itself and passes lore rows inline in the prompt.
"""

import json
import shutil
import subprocess
import time
from pathlib import Path

CLAUDE_BIN = 'claude'
DEFAULT_TIMEOUT = 120
TELEMETRY_PATH = Path(__file__).resolve().parent.parent / 'world' / 'telemetry.jsonl'


class HarnessError(Exception):
    """A claude invocation failed after retries (timeout, bad JSON, CLI error)."""


_boundary_index = None  # test override; production builds a fresh index per call


def _check_boundary(*texts):
    """Text-boundary tripwire (plan §2.5): no outgoing prompt may contain
    BOOK n-grams (wiki text is sanctioned prompt grounding). A trip is a bug
    in the caller, so BoundaryViolation propagates — never catch and retry.
    The index is books-only and rebuilt per call: one read-only sqlite open,
    so it stays fresh after ingest and safe under threaded callers."""
    from . import guardian
    index = _boundary_index or guardian.prompt_index()
    for t in texts:
        if t:
            guardian.check_prompt(t, index)


def availability():
    """Report whether the claude CLI is usable. Cheap enough for /api/health."""
    path = shutil.which(CLAUDE_BIN)
    if not path:
        return {'installed': False, 'error': 'claude CLI not found on PATH'}
    try:
        out = subprocess.run(
            [CLAUDE_BIN, '--version'],
            capture_output=True, text=True, timeout=15,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        return {'installed': True, 'path': path, 'error': str(e)}
    if out.returncode != 0:
        return {'installed': True, 'path': path,
                'error': out.stderr.strip() or f'exit {out.returncode}'}
    return {'installed': True, 'path': path, 'version': out.stdout.strip()}


def run_stateless(prompt, system_prompt=None, model=None, timeout=DEFAULT_TIMEOUT,
                  role='unspecified'):
    """One-shot call: prompt in, parsed-JSON dict out."""
    return _invoke(prompt, system_prompt=system_prompt, model=model,
                   timeout=timeout, role=role)


def run_conversational(prompt, session_id, resume=False, system_prompt=None,
                       model=None, timeout=DEFAULT_TIMEOUT, role='character'):
    """Continue (or start) a conversation pinned to `session_id`.

    First call for a session: resume=False (starts it with --session-id).
    Later calls: resume=True. On a stale/dead session this raises
    HarnessError — the caller's rebuild-from-dossier path handles it.
    """
    extra = ['--resume', session_id] if resume else ['--session-id', session_id]
    return _invoke(prompt, system_prompt=system_prompt, model=model,
                   timeout=timeout, role=role, extra_args=extra)


def _invoke(prompt, system_prompt=None, model=None, timeout=DEFAULT_TIMEOUT,
            role='unspecified', extra_args=None, _retry_context=None):
    cmd = [CLAUDE_BIN, '-p', '--output-format', 'json', '--allowedTools', '']
    if system_prompt:
        cmd += ['--append-system-prompt', system_prompt]
    if model:
        cmd += ['--model', model]
    if extra_args:
        cmd += extra_args

    full_prompt = prompt if _retry_context is None else (
        prompt
        + '\n\nYour previous reply was not valid JSON. Error: '
        + _retry_context
        + '\nReply again with ONLY a valid JSON object.'
    )

    _check_boundary(full_prompt, system_prompt)

    started = time.time()
    try:
        proc = subprocess.run(
            cmd, input=full_prompt, capture_output=True, text=True, timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        _log(role, model, started, ok=False, error='timeout')
        raise HarnessError(f'claude call timed out after {timeout}s')

    if proc.returncode != 0:
        err = proc.stderr.strip() or f'exit {proc.returncode}'
        _log(role, model, started, ok=False, error=err)
        raise HarnessError(f'claude CLI failed: {err}')

    try:
        envelope = json.loads(proc.stdout)
    except json.JSONDecodeError as e:
        _log(role, model, started, ok=False, error=f'bad envelope: {e}')
        raise HarnessError(f'unparseable CLI output: {e}')

    result_text = envelope.get('result', '')
    try:
        result = _parse_result_json(result_text)
    except json.JSONDecodeError as e:
        _log(role, model, started, ok=False, error=f'bad result JSON: {e}')
        if _retry_context is not None:
            raise HarnessError(f'model returned invalid JSON twice: {e}')
        # The first call created the session, so a conversational retry must
        # resume it — re-sending --session-id would collide with itself.
        if extra_args and extra_args[0] == '--session-id':
            extra_args = ['--resume', extra_args[1]]
        return _invoke(prompt, system_prompt=system_prompt, model=model,
                       timeout=timeout, role=role, extra_args=extra_args,
                       _retry_context=str(e))

    _log(role, model, started, ok=True, usage=envelope.get('usage'),
         cost_usd=envelope.get('total_cost_usd'))
    return result


def _parse_result_json(text):
    """Parse the model's reply as JSON, tolerating a markdown code fence."""
    text = text.strip()
    if text.startswith('```'):
        text = text[3:]
        if text.lstrip().startswith('json'):
            text = text.lstrip()[4:]
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3]
    return json.loads(text)


def _log(role, model, started, ok, error=None, usage=None, cost_usd=None):
    entry = {
        'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'role': role,
        'model': model or 'default',
        'duration_s': round(time.time() - started, 2),
        'ok': ok,
    }
    if error:
        entry['error'] = error
    if usage:
        entry['usage'] = usage
    if cost_usd is not None:
        entry['cost_usd'] = cost_usd
    try:
        TELEMETRY_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TELEMETRY_PATH, 'a') as f:
            f.write(json.dumps(entry) + '\n')
    except OSError:
        pass  # telemetry must never take down a game call
