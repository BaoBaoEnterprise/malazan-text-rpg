"""Entry pipeline: generate original-paraphrase lore entries (plan §2.2).

    python -m lore.entries generate "Anomander Rake:character" "Tellann:warren"
    python -m lore.entries build          # entries.jsonl -> lore.db
    python -m lore.entries check          # re-run guardian over entries.jsonl

Grounding is wiki text (if cached) + Claude's own knowledge of the series —
NEVER book chunks. Each generated entry passes the guardian n-gram gate
(against books-if-present and wiki) plus schema validation before it is
appended to the committed entries.jsonl. If the corpus is present, claimed
citations are spot-checked: the server searches chunks for the entry's key
terms and warns when a citation looks unsupported (pass/fail only — no text
returns to the model).
"""

import argparse
import json
import sys

from server import claude_harness, guardian
from .db import ENTRIES_JSONL, ENTRY_TYPES, build_lore_db, validate_entry
from .wiki import get_page

SYSTEM_PROMPT = """You are the lore scribe for a non-commercial Malazan fan
game. You write ORIGINAL summaries in your own words. Hard rules:
- Never reproduce sentences or distinctive phrasing from the novels or any
  wiki text you are given; write fresh prose.
- Ground yourself in the provided wiki extract (if any) and your own
  knowledge of the Malazan Book of the Fallen.
- Citations point to where a topic APPEARS in the books (main-series book
  title + chapter if you are confident), so a reader can look it up.
- spoiler_tier = the earliest main-series book (1-10, reading order,
  1=Gardens of the Moon) whose events the summary reveals.
Reply with ONLY a JSON object, no markdown, matching:
{"slug": "...", "type": "...", "title": "...", "summary": "3-6 sentences",
 "relations": {"slug": "how related", ...}, "spoiler_tier": 1,
 "citations": [{"book": "...", "chapter": "..."}], "sources": ["..."]}"""


def generate(topics, entries_path=None, use_wiki=True, progress=print):
    """topics: list of 'Title:type' strings. Appends accepted entries to
    entries.jsonl; returns (accepted, rejected) lists."""
    path = entries_path or ENTRIES_JSONL
    existing = {e['slug'] for e in load_entries(path)}
    index = guardian.NgramIndex()
    progress(f'guardian n-gram sources: {index.sources or "NONE (degraded)"}')

    accepted, rejected = [], []
    for topic in topics:
        title, _, etype = topic.partition(':')
        etype, _, tier_cap = etype.partition('@')
        etype = etype or 'character'
        tier_cap = int(tier_cap) if tier_cap else None
        if etype not in ENTRY_TYPES:
            rejected.append((topic, f'bad type {etype!r}'))
            continue

        wiki_page = get_page(title, fetch=False) if use_wiki else None
        prompt = _build_prompt(title, etype, wiki_page, tier_cap)
        try:
            entry = claude_harness.run_stateless(
                prompt, system_prompt=SYSTEM_PROMPT, role='lore-entry')
            problem = _vet(entry, index, existing)
            if not problem and tier_cap and entry['spoiler_tier'] > tier_cap:
                problem = (f"spoiler_tier {entry['spoiler_tier']} exceeds "
                           f'requested cap {tier_cap}')
        except claude_harness.HarnessError as e:
            problem = str(e)
        if problem:
            rejected.append((topic, problem))
            progress(f'REJECT {topic}: {problem}')
            continue

        entry['sources'] = sorted(
            set(entry.get('sources', [])) |
            ({f'wiki:{wiki_page["title"]}'} if wiki_page else {'model'}))
        with open(path, 'a') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        existing.add(entry['slug'])
        accepted.append(entry['slug'])
        progress(f'ok     {entry["slug"]} (tier {entry["spoiler_tier"]})')

    if accepted:
        n = build_lore_db(path)
        progress(f'rebuilt lore.db with {n} entries')
    return accepted, rejected


def check(entries_path=None):
    """Guardian + schema re-check of every committed entry. Returns problems."""
    index = guardian.NgramIndex()
    problems = []
    for e in load_entries(entries_path or ENTRIES_JSONL):
        try:
            validate_entry(e)
        except ValueError as err:
            problems.append((e.get('slug', '?'), str(err)))
            continue
        result = guardian.check_artifact(e['summary'], index)
        if not result['ok']:
            problems.append((e['slug'], f"n-gram overlap: {result['spans'][:2]}"))
    return problems


def load_entries(path=None):
    p = path or ENTRIES_JSONL
    entries = []
    try:
        with open(p) as f:
            for line in f:
                if line.strip():
                    entries.append(json.loads(line))
    except FileNotFoundError:
        pass
    return entries


def _build_prompt(title, etype, wiki_page, tier_cap=None):
    parts = [f'Write the lore entry for: {title} (type: {etype}).']
    if tier_cap:
        parts.append(
            f'This entry is read by players early in the series: reveal '
            f'nothing beyond book {tier_cap} (reading order) and set '
            f'spoiler_tier at most {tier_cap}. Use a slug in '
            f'lowercase_underscore_style.')
    if wiki_page:
        parts.append(
            'Wiki extract for grounding (CC-BY-SA; facts only — do NOT copy '
            'its wording):\n' + wiki_page['extract'][:4000])
    else:
        parts.append('No wiki extract available; use your own knowledge and '
                     'keep to well-established canon.')
    return '\n\n'.join(parts)


def _vet(entry, index, existing):
    if not isinstance(entry, dict):
        return 'model did not return an object'
    try:
        validate_entry(entry)
    except ValueError as e:
        return str(e)
    if entry['slug'] in existing:
        return 'duplicate slug'
    result = guardian.check_artifact(
        entry['title'] + ' ' + entry['summary'], index)
    if not result['ok']:
        return f"copied prose (n-grams: {result['spans'][:2]})"
    return None


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest='cmd', required=True)
    g = sub.add_parser('generate')
    g.add_argument('topics', nargs='+',
                   help='"Title:type" or "Title:type@tiercap" '
                        '(type defaults to character)')
    g.add_argument('--no-wiki', action='store_true')
    sub.add_parser('build')
    sub.add_parser('check')
    args = ap.parse_args(argv)

    if args.cmd == 'generate':
        accepted, rejected = generate(args.topics, use_wiki=not args.no_wiki)
        print(f'{len(accepted)} accepted, {len(rejected)} rejected')
        return 1 if rejected else 0
    if args.cmd == 'build':
        print(f'lore.db built with {build_lore_db()} entries')
        return 0
    problems = check()
    for slug, why in problems:
        print(f'PROBLEM {slug}: {why}')
    print(f'{len(problems)} problem(s)')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
