# KubeMastery Architecture, Agent Short Context

## Stack

- Astro 5 frontend
- Cloudflare Workers deployment (`@astrojs/cloudflare`, Wrangler envs)
- Supabase for auth and progress
- xterm terminal UI
- Vitest for unit and conformance tests

## High-Level Design

Simulation is split into clear domains:

- `src/core/kubectl/` command parsing and execution
- `src/core/cluster/` resources, events, bootstrap
- `src/core/control-plane/` and `src/core/kubelet/` reconciliation controllers
- `src/core/network/` service, DNS, traffic simulation
- `src/core/volumes/` PV/PVC and pod volume readiness
- `src/core/terminal/` terminal runtime and dispatch
- `src/core/filesystem/` virtual filesystem

## Core Contracts

- API-first runtime access via `ApiServerFacade`
- No direct read-model access from application code
- Reconciliation contract for critical controllers:
  - stable queue key
  - idempotent reconcile
  - `initialSync()` + periodic `resyncAll()`
- Status propagation chain is strict:
  - `Pod -> ReplicaSet -> Deployment`
  - `Pod -> DaemonSet`

## Bootstrap and Runtime

- Cluster bootstrap policy lives in `src/core/cluster/systemBootstrap.ts`
- Environment assembly happens in `src/core/emulatedEnvironment/EmulatedEnvironmentManager.ts`
- Runtime order:
  - bootstrap
  - controller start
  - supporting services (IP/network/volumes)

## Important Integration Points

- Terminal command flow enters via `src/core/terminal/core/handlers/KubectlCommandHandler.ts`
- `kubectl` parsing and validation live in `src/core/kubectl/commands/parser.ts`
- `kubectl` execution routes through command handlers in `src/core/kubectl/commands/handlers/`

## Product Surface

- Lesson pages: `src/pages/[lang]/[type]/[id]/[lessonId]/index.astro`
- Cheat sheet page: `src/pages/[lang]/cheat-sheet.astro`
- Course content and seeds: `src/courses/`

## Related Docs

- `doc/context/spec.md`
- `doc/context/conventions.md`
- `doc/context/roadmap.md`
