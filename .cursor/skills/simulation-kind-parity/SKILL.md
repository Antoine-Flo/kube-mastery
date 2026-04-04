---
name: simulation-kind-parity
description: Validates KubeMastery lesson scenarios by running the same kubectl commands on simulation and on local kind, then reports output mismatches and parity gaps. Use when the user provides an exercise in src/courses/**/content.md, asks to compare simulation vs kind outputs, or requests iterative parity fixes with architecture-gap warnings first.
---

# Simulation Kind Parity

## Purpose

Run the same scenario on:

- KubeMastery simulation runtime
- local kind cluster with kubectl

Then iterate on simulation behavior until parity is good enough for the exercise.

## Mandatory safety and scope rules

1. Always execute the exact same command string on both sides.
2. If a major architecture gap is detected, stop and report before broad edits.
3. Prefer architecture-sound and extensible fixes, and avoid piling up tactical patches that increase design debt.
4. Keep user lesson files unchanged unless explicitly requested.
5. Every mission includes process optimization for lower token usage and faster parity convergence.
6. Exercise adaptation is allowed when simulation limits block validation, but pedagogical intent must stay intact.

## What is a major architecture gap

Treat these as stop-and-warn conditions before any broad code change:

- Missing resource family or command family not implemented
- Missing runtime subsystem needed by scenario (network, volumes, controller chain)
- Incorrect domain model that would require cross-domain redesign
- Differences requiring fake test-only behavior

When detected, report:

- gap category
- impacted commands
- minimal viable implementation path
- estimated blast radius (small, medium, large)

## Inputs

- A lesson file path, usually `src/courses/**/content.md`
- Optional command subset from the user

## Course adaptation policy

The agent may adapt exercise commands when needed to keep validation runnable in simulation.

Allowed adaptation examples:

- replace unsupported container image with a semantically equivalent supported image
- simplify shell constructs not supported in simulation (`|`, `&&`, complex subshell patterns)
- split one complex command into 2-3 simpler commands with same learning objective

Adaptation constraints:

- keep the same pedagogical goal and troubleshooting signal
- keep command sequence understandable for learners
- prefer minimal edits to exercise steps
- explicitly report each adaptation and why it was needed
- do not add `kubectl wait` commands inside lesson content
- when waiting is needed in tests, keep waits in parity/test commands only, and in the lesson text ask learners to wait for resource creation while checking the workload visualizer

If adaptation would materially change the learning objective, stop and ask for user decision.

## Scenario extraction workflow

1. Read the exercise section, usually under `## Hands-On Practice`.
2. Extract shell commands from fenced bash blocks.
3. Preserve order exactly.
4. Keep comments as expectations metadata only, do not execute comment lines.
5. If cleanup commands are present, keep them at the end.

If extraction is ambiguous, ask for confirmation only once with a short candidate list.

## Execution workflow

Use the parity runner workflow already present in repository.

Default run:

```bash
npm run parity:manual -- --cmd "..."
```

Multi-command run:

```bash
npm run parity:manual -- --cmd "cmd1" --cmd "cmd2" --cmd "cmd3"
```

Verbose mode only when needed:

```bash
npm run parity:manual -- --verbose --cmd "..."
```

## Comparison strategy

Default output mode is compact:

- print only match or diff status per command
- print full outputs only for mismatches
- store full report in `.tmp/parity-last-report.json`

Treat as equivalent by default:

- AGE column differences
- dynamic service ClusterIP differences
- spacing-only differences in multiline stdout

Do not ignore:

- exit code differences
- resource status and readiness differences
- error class differences (NotFound vs Timeout vs validation errors)
- semantic output differences

## Iteration loop

1. Run extracted scenario on both runtimes.
2. Group mismatches by root cause:
   - output wording
   - lifecycle timing and readiness
   - networking and endpoints
   - command handler semantics
3. Choose the fix strategy that best improves long-term architecture quality, then implement the highest-impact root cause first.
4. Re-run full scenario.
5. Repeat until stable parity or architecture-gap stop condition.

## Continuous improvement mission

In addition to fixing parity gaps, always improve the comparison workflow itself.

Optimization goals:

- minimize token usage in assistant responses
- reduce number of reruns needed to converge
- increase signal-to-noise in mismatch reports
- keep simulation behavior aligned with real kubectl semantics

Default process improvements to apply:

- keep compact mode as default, verbose only for mismatches
- avoid repeating full matched outputs in chat
- write detailed artifacts to local report files, summarize in chat
- group mismatches by root cause and fix highest-impact root cause first
- after each run, propose one concrete workflow improvement if it reduces token cost or cycle time

## Reporting format to user

For each run, provide:

- total matched and mismatched command count
- top mismatch categories
- exact commands still failing parity
- next minimal fix plan

If all matched except expected dynamic fields, state parity is acceptable for scenario validation.

## Repository anchors

Key files commonly used by this workflow:

- `bin/parity/manual-compare.ts`
- `bin/lib/parity/simulation-session-manager.ts`
- `bin/lib/parity/kind-command-runner.ts`
- `bin/lib/executors/runner-executor.ts`
- `mcp/simulation-server/index.ts`

Typical simulation behavior fixes live under:

- `src/core/kubectl/commands/handlers/`
- `src/core/kubelet/controllers/`
- `src/core/network/`
- `src/core/control-plane/`

## Example trigger

Use this skill when user says:

- "validate this exercise against kind"
- "compare scenario outputs simulation vs kind"
- "iterate until this lesson scenario matches real kubectl behavior"
