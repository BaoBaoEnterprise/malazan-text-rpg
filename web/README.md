# The Barrows of Morn

A turn-based **Malazan-flavored text RPG** where you win by **wit, not numbers** — read a foe, research it in a cited in-game Codex, and apply the right counter. The wrong counter can get you killed.

Successor to the original Spider-Man text prototype (kept at repo root as legacy).

## Play it

It's a **client-side PWA** — no server, no accounts, no build step.

- **Locally:** serve the `web/` folder and open it. Because it uses plain `<script>` tags (no ES modules / fetch), you can even open `index.html` directly, though a tiny server is closer to real conditions:
  ```
  cd web && python3 -m http.server 8000
  # then open http://localhost:8000
  ```
- **On your iPhone / share with friends:** host `web/` on any static host (GitHub Pages, Netlify, etc.), send the link. In Safari, **Share → Add to Home Screen** installs it full-screen and offline.

## How it plays

- **Explore** a small region (the Barrows of Morn).
- **Encounter** dragons (Soletaken), swarms (D'ivers), and the undead (T'lan Imass).
- **Read** each foe: Observe, Probe (risky), and Recall Lore.
- **Recall Lore is gated** — it only works once you've *studied* the foe in the **Codex**. Research is the weapon.
- **Act** with the right approach (fire, ice, steel, or an otataral shard). Correct counter → win. Wrong counter → backfire.
- Progress saves **locally** to your device.

## Project layout

```
web/
  index.html        app shell
  style.css         mobile-first dark theme
  manifest.json     PWA metadata
  sw.js             service worker (offline / installable)
  src/data.js       all content: enemies, warrens, cited codex, scenario
  src/engine.js     turn-based encounter state machine
  src/app.js        UI + save/load
  icons/            app icons
```

**Adding content** = editing `src/data.js` (new enemies, codex entries, or nodes) — no code changes needed.

## A note on lore & copyright

The Malazan setting is Steven Erikson / Ian C. Esslemont's IP. This is a **non-commercial fan project** meant to be shared privately, not sold or published to an app store. Every Codex entry is an **original paraphrase written for this project** with a citation pointing to where the topic appears in the books — there is no verbatim text from the novels.
