---
name: refactor-lesson
description: Refactors a KubeMastery course lesson to apply all pedagogical principles defined in src/courses/prompt.md. Removes the Hands-On Practice section and distributes practice inline. Adds :::quiz blocks throughout. Use when the user says "refactor lesson", "rewrite lesson", "apply prompt to lesson", "améliorer leçon", or asks to improve a specific content.md file.
---

# Refactor Lesson

## Steps

1. Read `src/courses/prompt.md` — this is the source of truth for all pedagogical rules.
2. Read the target `content.md` file.
3. Rewrite the lesson fully applying every rule in the prompt. Do not paraphrase the rules, apply them structurally. The result should not be longer than the original. It should be slightly shorter.
4. Output the rewritten lesson directly into the file.

## Invariants (never break these)

- Preserve the frontmatter block (`---` ... `---`) exactly: `seoTitle`, `seoDescription`.
- Preserve the top-level `#` title.
- Do not change kubectl commands, manifest field names, or image names.
- Do not invent cluster behaviors not present in the original lesson.

## What to change

- **Remove** `## Hands-On Practice` as a standalone section.
- **Redistribute** every command from it into the body, immediately after the concept it demonstrates.
- **Add** `:::quiz` blocks after each major concept section (1 per section minimum). Pick the type from the prompt based on context:
  - MCQ for concept discrimination (confusing pairs)
  - Terminal for observable behaviors (run a command, read the output)
  - Reveal for causal/why questions
- **Move** diagrams (@@@ blocks) to appear before or alongside the text that explains them, never after.
- **Add** at least one failure/broken case using a `:::warning` callout.
- **Add** one elaborative "why" question answered inline per major section.
- **Build** YAML manifests incrementally if they were shown all-at-once.
- **Apply** desirable difficulty at least once: give the goal without the exact command, after the concept has been shown.

## Checking your work

After writing, verify:

- No `## Hands-On Practice` section remains.
- Every `:::quiz` block has `**Answer:**` to split question from reveal.
- At least one `:::warning` with a failure case.
- Diagrams appear before the text that references their nodes.
- The frontmatter and `#` title are unchanged.
- The length of the lesson is slightly shorter than the original.
