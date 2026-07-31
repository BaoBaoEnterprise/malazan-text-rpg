"""Malazan Wiki ingest (CC-BY-SA) via the MediaWiki API.

    python -m lore.wiki fetch "Anomander Rake" "T'lan Imass" ...
    python -m lore.wiki attribution

Pages are cached as JSON in lore/raw/ (gitignored) so ingest runs once;
ATTRIBUTION.md (committed) is regenerated from the cache. Fetching is
rate-limited and needs internet — on machines where fandom.com is
unreachable, cached pages are still served and fetch fails cleanly.
"""

import argparse
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = 'https://malazan.fandom.com/api.php'
RAW_DIR = Path(__file__).resolve().parent / 'raw'
ATTRIBUTION = Path(__file__).resolve().parent / 'ATTRIBUTION.md'
RATE_LIMIT_S = 1.5
USER_AGENT = 'BarrowsOfMorn-lore-ingest/1.0 (non-commercial fan project)'


def get_page(title, raw_dir=None, fetch=True):
    """Cached wiki page dict: {title, extract, url, fetched_at}. Returns None
    if uncached and fetch fails/disabled."""
    raw_dir = Path(raw_dir) if raw_dir else RAW_DIR
    cached = raw_dir / (_slug(title) + '.json')
    if cached.exists():
        return json.loads(cached.read_text())
    if not fetch:
        return None
    page = _fetch(title)
    if page:
        raw_dir.mkdir(parents=True, exist_ok=True)
        cached.write_text(json.dumps(page, indent=1))
    return page


def fetch_pages(titles, raw_dir=None):
    got = []
    for i, title in enumerate(titles):
        if i:
            time.sleep(RATE_LIMIT_S)
        page = get_page(title, raw_dir=raw_dir)
        print(f'{"ok " if page else "FAIL"} {title}')
        if page:
            got.append(page)
    write_attribution(raw_dir)
    return got


def write_attribution(raw_dir=None, out_path=None):
    """Regenerate ATTRIBUTION.md from the cache (CC-BY-SA obligation)."""
    raw_dir = Path(raw_dir) if raw_dir else RAW_DIR
    out = Path(out_path) if out_path else ATTRIBUTION
    pages = sorted(
        (json.loads(p.read_text()) for p in raw_dir.glob('*.json')),
        key=lambda d: d['title']) if raw_dir.is_dir() else []
    lines = [
        '# Attribution',
        '',
        'Lore entries in this project are original paraphrases informed in part',
        'by the [Malazan Wiki](https://malazan.fandom.com), whose text is',
        'available under [CC BY-SA](https://creativecommons.org/licenses/by-sa/3.0/).',
        'Derived entries are shared under the same license. Pages consulted:',
        '',
    ]
    lines += [f"- [{d['title']}]({d['url']})" for d in pages]
    if not pages:
        lines += ['- *(none yet — populated by `python -m lore.wiki fetch`)*']
    out.write_text('\n'.join(lines) + '\n')
    return len(pages)


def _fetch(title):
    params = urllib.parse.urlencode({
        'action': 'query', 'prop': 'extracts', 'explaintext': 1,
        'redirects': 1, 'titles': title, 'format': 'json'})
    req = urllib.request.Request(f'{API}?{params}',
                                 headers={'User-Agent': USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read())
    except OSError as e:
        print(f'  fetch failed for {title!r}: {e}', file=sys.stderr)
        return None
    pages = data.get('query', {}).get('pages', {})
    for pid, page in pages.items():
        if pid != '-1' and page.get('extract'):
            return {
                'title': page['title'],
                'extract': page['extract'],
                'url': 'https://malazan.fandom.com/wiki/'
                       + urllib.parse.quote(page['title'].replace(' ', '_')),
                'fetched_at': time.strftime('%Y-%m-%d', time.gmtime()),
            }
    return None


def _slug(title):
    return re.sub(r'[^a-z0-9]+', '_', title.lower()).strip('_')


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    sub = ap.add_subparsers(dest='cmd', required=True)
    f = sub.add_parser('fetch')
    f.add_argument('titles', nargs='+')
    sub.add_parser('attribution')
    args = ap.parse_args(argv)
    if args.cmd == 'fetch':
        fetch_pages(args.titles)
    else:
        n = write_attribution()
        print(f'ATTRIBUTION.md lists {n} pages')


if __name__ == '__main__':
    sys.exit(main())
