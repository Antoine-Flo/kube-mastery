---
name: simplify-course-lesson
description: Tightens KubeMastery course markdown lessons by removing true redundancy and heavy phrasing while preserving tone, facts, and structure. Skips hands-on practice sections entirely. Use when the user asks to simplify, shorten, or de-duplicate lesson prose in src/courses/, or when editing en/content.md (or fr) for readability without losing information.
---

# Simplify Course Lesson (Readability Pass)

## When to apply

Run this workflow when the user wants a lesson file made **easier to read** without a full rewrite: less repetition, less cognitive load, same teaching intent.

Default scope: `src/courses/**/content.md` (EN or FR).

## Hard boundaries (do not cross)

1. **Practice block is read-only**  
   From the first hands-on heading through end of file, **make no edits** (no wording, no formatting, no reordering).

   Treat as practice start when you see any of these as an `##` heading (case-insensitive, trim whitespace):

   - `Hands-On Practice`
   - `Hands-on Practice`
   - A heading whose title contains both **Practice** and **Hands** (e.g. lab titles)
   - `Try it yourself`, `Exercises`, `Lab` as a top-level `##` section if it clearly introduces step-by-step kubectl/YAML tasks

   If unsure whether a `##` section is conceptual vs practice: if it contains numbered steps with `kubectl`/`kubectl apply`/manifest filenames and terminal instructions, treat it as practice and do not edit.

2. **Preserve information**  
   Every fact, warning, API field name, behaviour, and caveat that was present before must still be present after. You may **rephrase and merge**; you may not **delete** a distinct teaching point.

3. **Preserve tone and register**  
   Keep the same voice (direct, instructor-like, CKA-oriented). Do not make it colder, more marketing-like, or more casual unless the file already is.

4. **Preserve structure and artefacts**  
   Keep headings hierarchy, tables, fenced code blocks (language tags), mermaid blocks, links, and admonitions (`:::info`, `:::warning`, etc.) intact. Only change **prose inside paragraphs and list item text** in the **non-practice** region, unless fixing an obvious typo that does not change meaning.

## What to simplify (allowed)

- **Repeated ideas**: the same point in an intro sentence, a following paragraph, and a callout; consolidate into one clear statement plus the callout if the callout adds nuance.
- **Stacked qualifiers**: chains of "this is important because..." that restate the heading; keep one strong reason.
- **Throat-clearing**: "In this section we will...", "It is worth noting that..." when the next sentence carries the content alone.
- **Parallel paragraphs**: two paragraphs that make the same contrast (e.g. RollingUpdate vs Recreate); merge while keeping the sharper example or warning.

## What not to do

- Do not remove or soften **warnings** or **exam-relevant** caveats to save space.
- Do not replace precise Kubernetes terms with vaguer ones.
- Do not move practice steps into the narrative or vice versa.
- Do not "simplify" by turning nuanced bullets into a single vague sentence that drops a case.

## Workflow

1. Read the full file. Locate the **first line** that starts the practice region per the rules above.
2. Edit **only** lines **above** that line (the conceptual/teaching body).
3. Re-read edited prose: confirm no fact loss, tone match, and practice region byte-for-byte unchanged (except unavoidable line-ending normalisation if the repo already uses it).
4. If the file has **no** practice section, still avoid touching any **numbered hands-on steps** or large YAML/bash blocks that read as lab instructions.

## Quick self-check before finishing

- [ ] Practice region untouched (from identified `##` through EOF).
- [ ] All `:::`, tables, code fences, mermaid unchanged except prose immediately outside them if needed.
- [ ] No new claims; no removed constraints or edge cases.
- [ ] Shorter or clearer sentences; less duplicate explanation.
