# Architecture - Kube Mastery

## Tech Stack

- **Frontend**: SolidJS 1.9.5
- **Terminal**: @xterm/xterm 5.5.0
- **Build**: Vite 7.1.4
- **Styling**: CSS pur avec variables CSS (`src/styles/`)
- **Icons**: lucide-solid 0.556.0
- **Routing**: @solidjs/router 0.15.1
- **Tests**: Vitest 4.0.15 + jsdom
- **Persistence**: localStorage (Phase 1), IndexedDB (Phase 2+)
- **YAML Parser**: yaml 2.8.2
- **Markdown**: marked 17.0.1
- **Backend**: Supabase (Auth, Database, Edge Functions)
- **i18n**: @inlang/paraglide-js 2.7.0

## Architectural Principles

- **KISS / DRY**
- **Functional Programming**: Pure functions préférées, classes pour encapsulation d'état
- **Design Patterns**: Factory, Result, Command, Observer, Strategy
- **Max Indentation**: 3 levels
- **No switch**: Object lookup ou if/else
- **Testable**: Dependency injection

## Core Patterns

### Result Types
```typescript
// src/core/shared/result.ts
type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E }
const success = <T>(value: T): Result<T>
const error = (message: string): Result<never>
```

### Factory Functions
```typescript
const createModule = (initialState?: State) => ({
  method1: () => void,
  toJSON: () => State
})
```

### Event-Driven Architecture
```typescript
// src/core/cluster/events/EventBus.ts
interface EventBus<E> {
  emit(event: E): void
  subscribe(type: string, handler: (e: E) => void): UnsubscribeFn
  subscribeAll(handler: (e: E) => void): UnsubscribeFn
}
```

**Fichiers**: `src/core/events/`, `src/core/cluster/events/`, `src/core/filesystem/events/`

**Types d'événements**: `AppEvent = ClusterEvent | FileSystemEvent`
- Cluster: PodCreated, PodDeleted, DeploymentCreated, ReplicaSetCreated, ServiceCreated, ServiceDeleted, ConfigMapCreated, SecretCreated, etc.
- Filesystem: FileCreated, FileModified, DirectoryCreated, etc.

### Kubernetes Controller Pattern
```typescript
// src/core/cluster/controllers/types.ts
interface Controller {
  start(): void
  stop(): void
  reconcile(key: string): void
}

interface WorkQueue {
  add(key: string): void
  start(handler: (key: string) => void): void
  stop(): void
}

interface ControllerState {
  getDeployments(namespace?: string): Deployment[]
  getReplicaSets(namespace?: string): ReplicaSet[]
  getPods(namespace?: string): Pod[]
  getNodes(): Node[]
  findDeployment(name: string, namespace: string): Result<Deployment>
  findReplicaSet(name: string, namespace: string): Result<ReplicaSet>
  findPod(name: string, namespace: string): Result<Pod>
}
```

**Fichiers**: `src/core/cluster/controllers/`
- `DeploymentController`: Crée/met à jour ReplicaSets
- `ReplicaSetController`: Crée/supprime Pods

**Principe**: Level-triggered, idempotent reconciliation

### Kubernetes Scheduler

Le Scheduler est un composant **séparé des controllers** (comme dans K8s réel).

```typescript
// src/core/cluster/scheduler/Scheduler.ts
interface Scheduler {
  start(): void
  stop(): void
}

interface SchedulerState {
  getNodes(): Node[]
  getPods(namespace?: string): Pod[]
  findPod(name: string, namespace: string): Result<Pod>
}
```

**Fichier**: `src/core/cluster/scheduler/`

**Flux**:
1. Watch `PodCreated` pour les pods sans `spec.nodeName`
2. Filter: trouve les nodes Ready et non-cordoned
3. Select: round-robin parmi les nodes feasibles
4. Bind: émet `PodUpdated` avec `nodeName` + `phase: Running`

**Initialisation**: `initializeScheduler(eventBus, clusterState)` dans `EmulatedEnvironmentManager.ts`

### Autocomplete System
```typescript
// src/core/terminal/autocomplete/
abstract class AutocompleteProvider {
  abstract priority(): number
  abstract match(tokens: string[], currentToken: string, line: string): boolean
  abstract complete(tokens: string[], currentToken: string, ctx: AutocompleteContext): CompletionResult[]
}

class AutocompleteEngine {
  registerProvider(provider: AutocompleteProvider): void
  getCompletionResults(line: string, ctx: AutocompleteContext): CompletionResult[]
}
```

**Providers**: `src/core/kubectl/autocomplete/`, `src/core/shell/autocomplete/`, `src/core/filesystem/autocomplete/`

### Command Dispatcher
```typescript
// src/core/terminal/core/CommandDispatcher.ts
interface CommandHandler {
  canHandle(command: string): boolean
  execute(command: string, context: CommandContext): ExecutionResult
}

class CommandDispatcher {
  dispatch(command: string, context: CommandContext): ExecutionResult
}
```

**Handlers**: `src/core/terminal/core/handlers/` (ShellCommandHandler, KubectlCommandHandler)

### Terminal Architecture
```typescript
// src/core/terminal/core/
class TerminalController { handleInput(data: string): void }
class InputHandler { handleInput(data: string): void }
class LineRenderer { redrawAfterBackspace(): void; replaceLine(line: string): void }
```

## Module Structure

```
src/
├── app.tsx                        # Root component
├── components/                    # UI Components
│   ├── ui/                        # Primitives (button, dialog, etc.)
│   ├── quiz/                      # Quiz components
│   ├── learnable/                 # Course navigation components
│   └── terminal.tsx
├── routes/[[lang]]/               # Pages avec i18n
├── styles/                        # CSS pur
│   ├── variables.css              # Design tokens
│   ├── reset.css
│   ├── components/
│   └── routes/
├── lang/core.tsx                  # i18n (useLang, useLangNavigate)
├── lib/                           # Utilities
│   ├── auth.tsx                   # AuthContext (Supabase)
│   ├── theme.tsx                  # ThemeContext
│   ├── quiz-types.ts              # Quiz types
│   ├── quiz-loader.ts
│   └── local-course-loader.ts
├── db/                            # Supabase client
├── core/
│   ├── events/                    # Event system
│   │   ├── types.ts               # BaseEvent, EventSubscriber
│   │   └── AppEvent.ts            # Union type
│   ├── cluster/
│   │   ├── events/EventBus.ts     # Observer pattern
│   │   ├── ressources/            # Pod, Deployment, ReplicaSet, ConfigMap, Secret, Service, Node
│   │   ├── controllers/           # DeploymentController, ReplicaSetController, WorkQueue
│   │   ├── scheduler/             # Scheduler (assigns pods to nodes)
│   │   ├── repositories/          # CRUD operations
│   │   ├── seeds/loader.ts        # Scenario loading (from seeds/scenarios/)
│   │   ├── initContainers/        # Init container simulation
│   │   └── logGenerator.ts
│   ├── containers/
│   │   ├── ImagePuller.ts
│   │   └── registry/ImageRegistry.ts
│   ├── filesystem/
│   │   ├── FileSystem.ts          # Factory
│   │   ├── models/                # File, Directory
│   │   ├── events/types.ts
│   │   └── autocomplete/
│   ├── kubectl/
│   │   ├── commands/
│   │   │   ├── parser.ts
│   │   │   ├── executor.ts
│   │   │   └── handlers/          # get, describe, delete, apply, logs, exec, etc.
│   │   ├── formatters/
│   │   └── autocomplete/
│   ├── shell/
│   │   ├── commands/
│   │   │   ├── core/              # Parser, Executor
│   │   │   └── handlers/          # navigation, fileops, editor, system
│   │   └── autocomplete/
│   ├── terminal/
│   │   ├── core/                  # Controller, InputHandler, LineRenderer, Dispatcher
│   │   ├── autocomplete/          # Engine, Provider base
│   │   ├── renderer/              # TerminalRenderer, XTermRenderer
│   │   └── TerminalManager.ts
│   ├── emulatedEnvironment/       # Environment orchestration
│   ├── storage/indexedDBAdapter.ts
│   └── shared/                    # result.ts, formatter.ts, parsing.ts
├── courses/                       # Course content (md + ts)
seeds/                             # Environment definitions
├── k8s/                           # Kubernetes component YAMLs
└── scenarios/                     # TypeScript scenario definitions
├── editor/                        # CodeMirror integration
└── logger/
```

## Key Data Types

```typescript
// src/core/cluster/ressources/
interface Pod { apiVersion: 'v1'; kind: 'Pod'; metadata: Metadata; spec: PodSpec; status: PodStatus }
interface Deployment { apiVersion: 'apps/v1'; kind: 'Deployment'; metadata: Metadata; spec: DeploymentSpec; status: DeploymentStatus }
interface ReplicaSet { apiVersion: 'apps/v1'; kind: 'ReplicaSet'; metadata: Metadata; spec: ReplicaSetSpec; status: ReplicaSetStatus }
interface ConfigMap { apiVersion: 'v1'; kind: 'ConfigMap'; metadata: Metadata; data: Record<string, string> }
interface Secret { apiVersion: 'v1'; kind: 'Secret'; metadata: Metadata; type: string; data: Record<string, string> }

// src/core/filesystem/models/
type FileSystemNode = DirectoryNode | FileNode
interface DirectoryNode { type: 'directory'; name: string; path: string; children: Map<string, FileSystemNode> }
interface FileNode { type: 'file'; name: string; path: string; content: string }

// src/lib/quiz-types.ts
type Question = MultipleChoiceQuestion | TerminalCommandQuestion | CommandQuestion | OrderQuestion
```

## Image Registry

**Fichier**: `src/core/containers/registry/`

Images disponibles: `nginx`, `redis`, `postgres`, `mysql`, `busybox`, `broken-app`, `private-image`

## Testing

- **Unit**: `tests/unit/` - Vitest + jsdom (~94% coverage)
- **Conformance**: `tests/conformance/` - OpenAPI validation (Pods, ConfigMaps, Secrets, Deployments)

## References

- `spec.md` - Features et comportements attendus
- `conventions.md` - Patterns de code et règles
- `roadmap.md` - Phases futures
