---
description: Architect mode — design, fan out junior agents on separate branches, two-layer review with ranked findings (Critical/High/Medium/Low/Nit), gated squash-merge.
argument-hint: "<feature 1>; <feature 2>; <feature 3> ..."
---

Orchestrate parallel development of: **$ARGUMENTS**

Use the `orchestrate` skill — you are the **architect**; `feature-dev` agents are junior
engineers. In short:

1. Pull requirements from `docs/stories/` and `docs/ux/` if they cover this work (run
   `/pm` / `/ux` first when the request is vague and nothing exists).
2. Write the design brief + work orders to `docs/designs/<run-slug>.md`: interfaces
   between concurrent features, file ownership, acceptance criteria per work order.
   Serialize work orders that overlap on files.
3. Fan out one `feature-dev` per work order in parallel (worktree isolation), branches
   per CLAUDE.md Branch strategy. Answer junior questions promptly via SendMessage.
4. Two-layer review per PR: `pr-reviewer` agent (ranked **Critical / High / Medium /
   Low / Nit**, checks acceptance criteria + design conformance) plus your own architect
   pass on integration seams; UX pass for UI changes.
5. Merge gate: zero Critical/High → `gh pr merge --squash --delete-branch`, landing in
   dependency order; otherwise findings go back to the same junior to fix, then
   re-review. Rebase later branches on conflicts; record unfixed Mediums as follow-ups.
6. Finish with the full table (work order | branch | PR | verdict | finding counts |
   merge state | follow-ups) and sync local `main`.

If $ARGUMENTS is empty or a single feature, say so — one feature doesn't need
orchestration; build it directly (or with one `feature-dev` agent).
