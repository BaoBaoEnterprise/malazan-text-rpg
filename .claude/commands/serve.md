---
description: Serve the web/ PWA locally on a static server for testing.
argument-hint: "[port]"
allowed-tools: Bash(python3 -m http.server:*)
---

Serve the game so it can be opened in a browser. It's a client-side PWA — no backend needed.

Run a static server from the `web/` folder on port ${ARGUMENTS:-8000}, in the background:

```bash
cd web && python3 -m http.server ${ARGUMENTS:-8000}
```

Then tell the user the URL (`http://localhost:${ARGUMENTS:-8000}`). If they want you to
verify a change, follow up with the `playtest` skill to drive it in the browser.
