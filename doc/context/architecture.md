# Architecture - Kube Mastery

## Tech Stack

- **Frontend**: Astro 5
- **Hosting**: Cloudflare (adapter `@astrojs/cloudflare`)
- **Terminal**: @xterm/xterm 6
- **Build**: Astro
- **Styling**: CSS avec variables (`src/styles/`), lightningcss
- **Icons**: @lucide/astro
- **i18n**: `messages/*.json` + `src/i18n/ui.ts`, `useTranslations(lang)`, `useLocalePath(lang)`
- **Persistence**: localStorage, IndexedDB (`src/core/storage/`)
- **YAML**: yaml 2.8.2
- **Markdown**: Astro Content (build-time), astro-expressive-code, astro-mermaid
- **Backend**: Supabase (Auth, progress via `src/lib/`)
- **Tests**: À migrer (prévu) — Vitest, `tests/unit/`, `tests/conformance/`, golden files `bin/`
- **DB**: À migrer (prévu) — Drizzle, `src/db/`

## Principles

- **KISS / DRY** — Functional style, pure functions ; classes pour état. Result types, Factory, Command, Observer. Max indentation 3, no switch (object lookup / if-else). Testable, dependency injection.

## Core Patterns

### Result Types

`src/core/shared/result.ts` — `Result<T, E>`, `success()`, `error()`.

### Event-Driven

`src/core/cluster/events/EventBus.ts` — `emit`, `subscribe`, `subscribeAll`. Events: `AppEvent = ClusterEvent | FileSystemEvent` (PodCreated, FileCreated, etc.). Fichiers: `src/core/events/`, `src/core/cluster/events/`, `src/core/filesystem/events/`.

### Kubernetes Controllers

`src/core/cluster/controllers/` — `Controller` (start, stop, reconcile), `WorkQueue`. DeploymentController → ReplicaSets ; ReplicaSetController → Pods. Level-triggered, idempotent.

### Scheduler

`src/core/cluster/scheduler/` — séparé des controllers. Watch PodCreated (sans nodeName), filter nodes Ready, round-robin, bind. Init dans `EmulatedEnvironmentManager.ts`.

### Autocomplete

`src/core/terminal/autocomplete/` — `AutocompleteProvider`, `AutocompleteEngine`. Providers: kubectl, shell, filesystem.

### Command Dispatcher

`src/core/terminal/core/CommandDispatcher.ts` — `CommandHandler` (canHandle, execute). Handlers: ShellCommandHandler, KubectlCommandHandler dans `handlers/`.

### Terminal

`src/core/terminal/core/` — TerminalController, InputHandler, LineRenderer. Montage client : `src/components/terminal-mount.ts`, `LessonTerminal.astro`.

## Module Structure

```
src/
├── pages/
│   ├── [lang]/                    # i18n (index, courses, auth, pricing, privacy, terms)
│   │   ├── [type]/[id]/          # overview cours/module
│   │   │   └── [lessonId]/       # page leçon
│   │   └── auth/
│   └── api/                      # auth (callback, register, signin, signout), progress/complete
├── layouts/
│   └── Layout.astro
├── components/                   # Astro + mounts TS (terminal-mount, cluster-viewer-mount)
│   ├── ui/
│   ├── lesson/                   # LessonQuizNav, LessonTerminal, LessonClusterViewer, etc.
│   └── overview/
├── content/                      # Content collections (courses, overview), facades
├── courses/                      # course-structure.ts, modules/*, seeds/ (minimal, demo, getSeed)
├── lib/
│   ├── supabase.ts
│   └── progress/                 # domain, server, supabase-adapter
├── i18n/                         # ui.ts, utils.ts (useTranslations, useLocalePath)
├── styles/                       # variables.css, reset, components/, routes/
├── core/
│   ├── events/
│   ├── cluster/                  # EventBus, ressources, controllers, scheduler, repositories, seeds/loader, initContainers
│   ├── containers/registry/
│   ├── filesystem/               # FileSystem, models, events, autocomplete
│   ├── kubectl/                  # commands (parser, executor, handlers), formatters, autocomplete
│   ├── shell/                    # commands, autocomplete
│   ├── terminal/                 # core, autocomplete, renderer, TerminalManager
│   ├── emulatedEnvironment/
│   ├── storage/
│   ├── editor/                   # CodeMirror
│   └── shared/                   # result, formatter, parsing
├── types/                        # quiz.ts
└── logger/
```

**À migrer (prévu)** : `src/db/` (Drizzle, schéma, client Postgres).

## Key Data Types

- **Cluster** (`src/core/cluster/ressources/`): Pod, Deployment, ReplicaSet, ConfigMap, Secret, Service, Node.
- **Filesystem** (`src/core/filesystem/models/`): FileSystemNode = DirectoryNode | FileNode.
- **Quiz** (`src/types/quiz.ts`): MultipleChoiceQuestion, TerminalCommandQuestion, CommandQuestion, OrderQuestion.

## Image Registry

`src/core/containers/registry/` — nginx, redis, postgres, mysql, busybox, broken-app, private-image.

## References

- `spec.md` — Features et comportements
- `conventions.md` — Patterns de code
- `roadmap.md` — Phases futures
