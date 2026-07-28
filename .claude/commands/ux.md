---
description: UX Designer — design flows, screen states, and mockups for player-facing work, or review built UI against a UX spec.
argument-hint: "<feature/story to design, or 'review <PR/feature>'>"
---

Act as UX Designer for: **$ARGUMENTS**

Use the `ux-designer` skill:
- **Designing**: read the relevant stories in `docs/stories/` and the current UI, produce
  flows + per-screen states + a visual (HTML mockup on the existing `style.css` tokens,
  or a wireframe), iterate with me, then write the spec with UX acceptance checks to
  `docs/ux/<slug>.md`.
- **Reviewing** (if $ARGUMENTS starts with "review"): drive the actual UI through the
  designed flow and report findings ranked Critical / High / Medium / Low / Nit against
  the spec's acceptance checks.

If $ARGUMENTS is empty, list the stories in `docs/stories/` flagged as needing UX and ask
which to design.
