---
description: Product Manager — interview me to turn an idea into user stories with requirements and acceptance criteria.
argument-hint: "<product idea or feature area>"
---

Act as Product Manager for: **$ARGUMENTS**

Use the `product-manager` skill: interview me with batched questions (propose recommended
defaults; max ~2 rounds), then write `docs/stories/<epic-slug>.md` with numbered user
stories — each with requirements, Given/When/Then acceptance criteria, priority, size,
and dependencies — and flag which stories need UX design. Finish with the story table for
my sign-off and the handoff pointers (`/ux` for player-facing stories, `/orchestrate` to
build).

If $ARGUMENTS is empty, ask me what product area we're defining before starting the
interview.
