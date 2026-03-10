# Architecture - KubeMastery

## Tech Stack

- **Frontend**: Astro 5
- **Hosting**: Cloudflare Workers (adapter `@astrojs/cloudflare`)
- **Runtime envs**: Wrangler envs (`production` par défaut + `staging` via `--env staging`)
- **Deployment orchestration**: Dagger (TypeScript module `ci/dagger`) + recipes `just`
- **Terminal**: @xterm/xterm 6
- **Build**: Astro
- **Styling**: CSS avec variables (`src/styles/`), lightningcss
- **Icons**: @lucide/astro
- **i18n**: `messages/*.json` + `src/i18n/ui.ts`, `src/config.ts`, `useTranslations(lang)`, `useLocalePath(lang)`, middleware de gate locale (`src/middleware.ts`)
- **Persistence**: localStorage, IndexedDB (`src/core/storage/`)
- **YAML**: yaml 2.8.2
- **Markdown**: Astro Content (build-time), astro-expressive-code, astro-mermaid
- **Backend**: Supabase (Auth, progress via `src/lib/`)
- **Tests**: Vitest, `tests/unit/`, `tests/conformance/`, golden files `bin/`
- **DB**: À migrer (prévu) — Drizzle, `src/db/`

## Delivery Model

- **Branching**: single branch (`main`) for both production and staging flows.
- **Deploy commands**:
  - `just deploy-staging` -> Dagger `deploy-staging` -> `wrangler deploy --env staging`
  - `just deploy-production` -> Dagger `deploy-production` -> `wrangler deploy`
- **Quality gate before deploy**: module Dagger runs `npm ci`, `npm run check`, `npm run test`, `npm run build` before any publish.
- **Secrets model**:
  - local runtime via `.env` (loaded by `just` with `dotenv-load`)
  - Cloudflare secrets set with `wrangler secret put <KEY>` and `wrangler secret put <KEY> --env staging`

## Principles

- **KISS / DRY:** Functional style, pure functions ; classes pour état. Result types, Factory, Command, Observer. Max indentation 3, no switch (object lookup / if-else). Testable, dependency injection.

## Core Patterns

### Result Types

`src/core/shared/result.ts` — `Result<T, E>`, `success()`, `error()`.

### Event-Driven

`src/core/cluster/events/EventBus.ts` — `emit`, `subscribe`, `subscribeAll`. Events: `AppEvent = ClusterEvent | FileSystemEvent` (PodCreated, FileCreated, etc.). Fichiers: `src/core/events/`, `src/core/cluster/events/`, `src/core/filesystem/events/`.

### Kubernetes Controllers

`src/core/cluster/controllers/` — socle unique `ReconcilerController` (`start`, `stop`, `reconcile`, `initialSync`, `resyncAll`) + `WorkQueue`.

- DeploymentController -> ReplicaSets
- ReplicaSetController -> Pods
- DaemonSetController -> 1 Pod par node eligible
- SchedulerController -> binding (`nodeName`) uniquement
- PodLifecycleController -> progression de phase (`Pending -> Running`)

Tous les controllers runtime critiques sont level-triggered, idempotents, et appliquent la strategie `event + initial sync + periodic resync`.

### Scheduler

Le scheduler est aligne sur le pattern controller via `SchedulerController`:

- observe les changements Pod,
- enfile une key `namespace/name`,
- reconcilie le binding via predicates (`SimSchedulingPredicates`) + round-robin,
- n'ecrit pas la phase (responsabilite reservee a `PodLifecycleController`).

### Pod IP Allocation

`src/core/cluster/ipAllocator/` — allocation d'IP Pod centralisée (`SimPodIpAllocator`) avec unicité par pod actif et libération sur suppression. Intégré via `SimPodIpAllocationService` dans le cycle de vie de l'environnement.

### Network Simulation Runtime

La simulation reseau est desormais isolee dans `src/core/network/`:

- `NetworkController`: reconcile event-driven des Services/Pods vers un etat reseau derive,
- `NetworkState`: index runtime (ClusterIP, NodePort, endpoints, lookup helpers),
- `ServiceIpAllocator` et `NodePortAllocator`: attribution deterministe + prevention des collisions,
- `DnsResolver`: resolution A records (`service`, `service.namespace`, `service.namespace.svc`, `service.namespace.svc.cluster.local`),
- `TrafficEngine`: simulation de trafic HTTP intra-cluster et NodePort.

Points d'integration:

- bootstrap runtime dans `src/core/emulatedEnvironment/EmulatedEnvironmentManager.ts` via `initializeSimNetworkRuntime(...)`,
- injection dans le flux terminal/kubectl via `CommandContext.networkRuntime`,
- commandes supportees en execution: `kubectl expose`, `kubectl exec ... nslookup`, `kubectl exec ... curl`, et flux diagnostic court `kubectl run ... --rm -it --command -- nslookup|curl ...`.

### Volumes Simulation Runtime

La simulation volumes est isolee dans `src/core/volumes/`:

- `VolumeState`: index runtime (`claim -> volume`, readiness pod, hostPath reserve),
- `VolumeBindingController`: binding statique PV/PVC idempotent, event-driven,
- `PodVolumeController`: evaluation readiness volumes au niveau Pod,
- `VolumeBindingPolicy`: policy dediee (V2) pour matching capacite / accessModes / storageClass.

Points d'integration:

- bootstrap runtime dans `src/core/emulatedEnvironment/EmulatedEnvironmentManager.ts` via `initializeSimVolumeRuntime(...)`,
- gate de progression dans `PodLifecycleController` via `volumeReadinessProbe`,
- support event-driven complet via `ClusterState` + `EventBus` pour `PersistentVolume*` et `PersistentVolumeClaim*`.

### Cluster Bootstrap Policy

Le bootstrap cluster est centralise dans `src/core/cluster/ClusterState.ts` via `createClusterState(...)`.

- Point unique de verite: tous les callsites passent par la meme policy.
- Configuration explicite:
  - `profile`: `kind-like` | `none`
  - `mode`: `always` | `missing-only` | `never`
- Implementation des ressources bootstrap dans `src/core/cluster/systemBootstrap.ts`.
- Workloads système simulés via `src/core/cluster/systemWorkloads/SimSystemWorkloadsController.ts`:
  - static pods control-plane
  - daemonset-like (1 pod par node)
  - deployment-like (replicas schedulées)
- Policy conformance explicite: CoreDNS ciblé control-plane pour alignement avec le baseline `artifacts/conformance/kind.log`.
- Topologie des nodes centralisee dans `src/core/cluster/clusterConfig.ts` et alignee sur le YAML partage `src/courses/seeds/clusterConfig/multi-node.yaml` (source commune kind + simulateur).
- Points d'integration principaux:
  - `src/core/emulatedEnvironment/EmulatedEnvironmentManager.ts`
  - `src/core/cluster/seeds/loader.ts`
  - `bin/lib/executors/runner-executor.ts`
  - ordre runtime: bootstrap -> controllers runtime -> ip allocation service -> network runtime

### Runtime Controller Contract Checklist

Checklist obligatoire pour tout nouveau composant runtime critique:

1. Events observes explicitement listes.
2. Key d'enqueue deterministe (`namespace/name` ou equivalent stable).
3. Invariant metier explicite et verifiable.
4. `initialSync()` implemente et appele au `start()`.
5. `resyncAll()` implemente (periodic resync configurable).
6. Tests d'invariants agnostiques a l'ordre des evenements (create avant/apres start, restart, replay partiel).

### Status Propagation Invariants

Invariants explicites pour eviter les derives `READY 0/x`:

1. `Pod -> ReplicaSet -> Deployment` est la seule chaine de verite pour les compteurs `readyReplicas` et `availableReplicas`.
2. `ReplicaSetController` doit watch les transitions `PodUpdated` (pas seulement create/delete), car le readiness evolue principalement pendant le lifecycle Pod.
3. Le calcul `ready` des ReplicaSets privilegie `PodCondition Ready=True`, avec fallback `phase=Running` pour compatibilite.
4. Les DaemonSets suivent le meme contrat de propagation status (`Pod -> DaemonSet`) et doivent aussi reagir a `PodUpdated`.
5. Les controllers runtime critiques exposent une observabilite minimale (`enqueue`, `reconcile`, `skipReason`) pour diagnostiquer rapidement les divergences d'etat.
6. Le periodic resync reste un filet de securite, pas une substitution a une couverture complete des evenements.

### Autocomplete

`src/core/terminal/autocomplete/` — `AutocompleteProvider`, `AutocompleteEngine`. Providers: kubectl, shell, filesystem.

### Command Dispatcher

`src/core/terminal/core/CommandDispatcher.ts` — `CommandHandler` (canHandle, execute). Handlers: ShellCommandHandler, KubectlCommandHandler dans `handlers/`.

### kubectl Help Resolution

Le flux help est resolu en pre-parse dans la couche commandes kubectl (`src/core/kubectl/commands/parser.ts` / `executor.ts`) pour garantir:

- priorite de `-h` / `--help` sur les validations metier,
- `exitCode=0` en mode help,
- absence d'effet de bord (pas d'execution des handlers metier).

### Structured Get Projection

Le rendu structure (`-o json|-o yaml`) pour `kubectl get` passe par une projection dediee par type de ressource:

- `Pod`: projection via `shapePodForStructuredOutput(...)`,
- `Deployment`: projection via `shapeDeploymentForStructuredOutput(...)`, avec metadata/status Kubernetes-like et suppression des annotations internes `sim.kubernetes.io/*`.

Cette couche evite les derives de format depuis les objets runtime internes et stabilise la parite conformance sans code path specifique aux scenarios.

### API Discovery Catalog

`kubectl api-resources` repose sur un catalogue discovery dedie pour decoupler:

- ressources executees par le simulateur,
- ressources exposees par discovery (parite kind-like, tri, filtres, formats).

Ce registre alimente toutes les sorties (`table`, `wide`, `name`, `json`, `yaml`) depuis une source unique pour eviter les derives de format.

### Create/Delete Semantics Layer

La couche handlers kubectl aligne explicitement les messages create/delete sur des references kube (`deployment.apps/...`) et sur les conventions de namespace:

- `create`/`apply` construisent une reference de ressource adaptee au groupe API,
- `delete` namespaced ajoute `from <namespace> namespace`,
- les cas `NotFound` critiques (deployments) sont normalises avec `deployments.apps`.

Extension Ingress (baseline):

- `create`/`apply` pour `Ingress` utilisent la reference groupee `ingress.networking.k8s.io/<name>`,
- `delete ingress` suit la convention namespaced (`deleted from <namespace> namespace`),
- le rendu `get/describe` reste volontairement orienté API/object sans simulation de controller L7.

### Run Command Semantics Layer

Le flux `kubectl run` repose sur la meme architecture parseur/transformer/handler:

- parsing dedie dans `src/core/kubectl/commands/transformers.ts` (`runTransformer`),
- validations semantiques centralisees dans `src/core/kubectl/commands/parser.ts`,
- execution dans `src/core/kubectl/commands/handlers/applyCreate.ts` (`handleRun`) puis persistence via `createResourceWithEvents`.

Portee actuelle:

- support de `--image`, `--command -- <cmd>`, `-- <args...>`, `--env`, `--labels`, `--port`, `--dry-run=client`, `-i/--stdin`, `-t/--tty`, `--rm`,
- `kubectl run ... --dry-run=client -o yaml` retourne un manifeste Pod YAML sans persister de ressource,
- `--restart` accepte uniquement `Never` (les autres valeurs sont explicitement rejetees pour rester coherentes avec le modele Pod-only du simulateur).

### Terminal kubectl output redirection

La redirection de sortie `>` est prise en charge au niveau handler kubectl (`src/core/terminal/core/handlers/KubectlCommandHandler.ts`) avec un scope volontairement limite:

- parsing local d'une redirection simple `kubectl ... > file`,
- execution de la commande kubectl sans la partie redirection,
- ecriture de la sortie standard dans le filesystem virtuel via `FileSystem.writeFile(...)`,
- en cas de redirection active, la sortie standard n'est pas affichee dans le terminal,
- les erreurs kubectl ou redirection restent affichees comme erreurs terminal.

### Cluster-Info Dump Behavior

`cluster-info` et `cluster-info dump` partagent un renderer central:

- URL control-plane + ligne CoreDNS pour la sortie standard,
- rendu `dump` en listes Kubernetes (`NodeList`, `PodList`, etc.),
- prise en charge de `--output-directory` en mode confirmation pour conserver la compatibilite CLI.

### Terminal

`src/core/terminal/core/` — TerminalController, InputHandler, LineRenderer. Montage client : `src/components/terminal-mount.ts`, `LessonTerminal.astro`.

### Cheat Sheet Page

Page cheat sheet: `src/pages/[lang]/cheat-sheet.astro`.

- Reutilise `ContentWithTerminalLayout` (meme layout que les pages de lecon, sans duplication),
- charge le contenu markdown depuis `src/courses/cheat-sheets/kubectl-quick-ref.md`,
- applique une protection d'acces au niveau route via `getLayoutAuthContext(...)` (abonnement actif requis).

### Navigation Shells

La navbar est pilotee par variante (`marketing` | `app`) dans `src/components/Navbar.astro`:

- `marketing`: navbar centree pour pages publiques,
- `app`: navbar full-width pour pages applicatives (cours, terminal, cheat sheet).

## Module Structure

```
src/
├── ci/
│   └── dagger/                    # module Dagger TS (testAndBuild, deployStaging, deployProduction)
├── justfile                       # recipes build/check/test/deploy
├── wrangler.jsonc                 # worker config + env staging
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
├── courses/                      # course-structure.ts, modules/*, seeds/ (filesystem seeds + getSeed), cheat-sheets/*
├── lib/
│   ├── supabase.ts
│   └── progress/                 # domain, server, supabase-adapter
├── i18n/                         # ui.ts, utils.ts (useTranslations, useLocalePath)
├── config.ts                     # single runtime config object (i18n/cluster/runtime/storage/billing)
├── middleware.ts                 # redirections de locales desactivees
├── styles/                       # variables.css, reset, components/, routes/
├── core/
│   ├── events/
│   ├── cluster/                  # EventBus, ressources, controllers, scheduler, repositories, seeds/loader, initContainers
│   ├── containers/registry/
│   ├── filesystem/               # FileSystem, models, events, autocomplete
│   ├── kubectl/                  # commands (parser, executor, handlers), formatters, autocomplete
│   ├── volumes/                  # VolumeState, VolumeBindingController, PodVolumeController, policies
│   ├── shell/                    # commands, autocomplete
│   ├── terminal/                 # core, autocomplete, renderer, TerminalManager
│   ├── emulatedEnvironment/
│   ├── storage/
│   ├── editor/                   # CodeMirror
│   └── shared/                   # result, formatter, parsing
├── types/                        # quiz.ts
└── logger/
```

## Language Rollout Strategy

- **Focus actuel**: version **EN** uniquement pour accelerer la production de contenu et le lancement.
- **FR** est conserve dans le code et les messages, mais verrouille via flag dans `src/config.ts` (`CONFIG.i18n.enableFrenchUi`).
- Quand FR est desactive:
  - les URLs `/fr/*` sont redirigees vers `/en/*`,
  - le switch de langue est masque dans le footer.

**À migrer (prévu)** : `src/db/` (Drizzle, schéma, client Postgres).

## Key Data Types

- **Cluster** (`src/core/cluster/ressources/`): Pod, Deployment, ReplicaSet, DaemonSet, ConfigMap, Secret, Service, Ingress, Node, PersistentVolume, PersistentVolumeClaim.
- **Filesystem** (`src/core/filesystem/models/`): FileSystemNode = DirectoryNode | FileNode.
- **Quiz** (`src/types/quiz.ts`): MultipleChoiceQuestion, TerminalCommandQuestion, CommandQuestion, OrderQuestion.

## Image Registry

`src/core/containers/registry/` — nginx, redis, postgres, mysql, busybox, broken-app, private-image.

## References

- `spec.md` — Features et comportements
- `conventions.md` — Patterns de code
- `roadmap.md` — Phases futures
