---
name: playtest
description: Serve the web/ PWA and drive it in a browser to verify a change actually plays — encounters resolve, the right counter wins, study→recall works, saves persist. Use to confirm a gameplay or content change works, not just that the code parses.
---

# Playtest The Barrows of Morn

Verify behavior by actually playing it, not by reading code.

## 1. Serve it
Start a static server from the game folder (the game is a client-side PWA, no backend):

```bash
cd web && python3 -m http.server 8000
```

Run it in the background so you can drive the browser. Open `http://localhost:8000`.

## 2. Drive it in the browser
Use the browser tools (`mcp__Claude_Browser__*`): `navigate` to the URL, then `read_page` /
`computer` to click through. Walk the specific flow your change touched:
- Start a new game and reach the encounter under test.
- Try the **correct counter** → expect a win/resolution. Try a **backfire** → expect the
  player to be hurt. Try a **neutral** approach → expect no progress, no crash.
- Exercise the **read → study Codex → recall** path: recall lore should only pay off after
  the matching Codex entry is studied.
- Reload the page → confirm the save restored (or a fresh save shape didn't corrupt).

## 3. Check for errors
Use `read_console_messages` (onlyErrors) — there should be no exceptions. A silent JS error
often looks like "the button did nothing."

## 4. Report
State what you exercised, what you observed, and whether it matched intent. If you changed
cached assets, confirm you bumped the cache name in `sw.js` (else a reload serves stale files
— test in a private window or after unregistering the service worker).

Stop the server when done.
