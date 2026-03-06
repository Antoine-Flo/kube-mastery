# Specification - KubeMastery

## Vision

Interactive web application for learning `kubectl` commands through a simulated terminal with a stateful virtual Kubernetes cluster.

**Philosophy**: Full terminal experience, like the real CKA/CKAD exam.

## Project Objectives

### Phase 1: MVP ✅ (Completed)

- Functional terminal with xterm.js (centered, styled)
- kubectl command interpreter (get, describe, delete, create, apply, run, logs, exec, label, annotate, version, cluster-info, api-resources)
- Stateful virtual cluster (namespaces, pods, deployments, services, configmaps, secrets)
- Local persistence (localStorage with auto-save)
- Virtual filesystem for YAML manifests
- Multi-container pods and init containers support
- In-terminal editor (nano/vim emulation)

> For Phase 2 and Phase 3 objectives, see [roadmap.md](roadmap.md)

## Routing

- **Overview** : `/[lang]/[type]/[id]` (type = courses | modules).
- **Leçon** : `/[lang]/[type]/[id]/[lessonId]`.
- **Autres** : `/[lang]/courses`, `/[lang]/auth`, `/[lang]/pricing`, etc.
- **Rollout langue (actuel)** : EN prioritaire. FR reste disponible dans le code mais est desactive via `src/config.ts` (`CONFIG.i18n.enableFrenchUi = false`) ; `/fr/*` redirige vers `/en/*`.

## Core Features

### kubectl (Phase 1)

get (pods, deploy, rs, services, ingresses, ingressclasses, configmaps, secrets, nodes, pv, pvc), describe, delete, create -f, apply -f, run, expose, logs, exec -it, label, annotate, version (--client, --output json/yaml), cluster-info, cluster-info dump, api-resources (--output wide, --namespaced, --sort-by). Détail : voir `src/core/kubectl/commands/handlers/`.

### kubectl Realism Guarantees (current baseline)

- Structured outputs for `kubectl get` are explicit:
  - collection queries in `-o json|-o yaml` return a `List` shape (`apiVersion`, `kind`, `metadata.resourceVersion`, `items`), including empty results,
  - named queries (`kubectl get <resource> <name> -o json|-o yaml`) return a single object shape.
- `kubectl get pods -A` and `kubectl get pods -A -o wide` include `NAMESPACE` as first column.
- JSON output indentation for structured `get` output follows a stable 4-space formatting.
- Table rendering for `kubectl get` uses consistent spacing tuned against `kind` output to reduce visual drift.
- Help behavior is explicit:
  - `kubectl -h` and `kubectl --help` are resolved before action validation,
  - `<command> --help` returns usage/help text and does not execute command side effects.
- `kubectl api-resources` behavior is explicit:
  - supported output modes: default table, `wide`, `name`, `json`, `yaml`,
  - supported options: `--namespaced=true|false`, `--sort-by=name|kind`, `--no-headers`,
  - JSON/YAML output is emitted as `APIResourceList` with stable ordering.
- Create/Delete behavior is explicit:
  - `kubectl create deployment ...` emits `deployment.apps/<name> created`,
  - `kubectl create deployment` rejects multiple `--image` when combined with command (`-- ...`),
  - `kubectl delete` namespaced resources emit `deleted from <namespace> namespace`,
  - deleting a missing deployment emits `Error from server (NotFound): deployments.apps "<name>" not found` with non-zero exit code.
- `kubectl run` baseline:
  - supports `kubectl run NAME --image=<image>`,
  - supports `--command -- <cmd> [args...]` and `-- <arg1> <arg2> ...`,
  - supports `--env`, `--labels`, `--port`, `--dry-run=client`, `-i/--stdin`, `-t/--tty`, `--rm`,
  - current simulator scope limits restart policy handling to `--restart=Never` (other values return explicit error).
- `kubectl logs` baseline:
  - generates deterministic logs using workload profiles (control-plane components, nginx startup/runtime, db-like and generic app logs),
  - avoids synthetic HTTP access traffic for nginx by default (startup/runtime process logs only),
  - aligns error contract to kubectl style (`stderr` + non-zero exit code for invalid target/flags),
  - supports `--tail`; `--tail=0` returns empty output, and non-numeric values return a kubectl-like parsing error.
- `kubectl expose` baseline:
  - supports `kubectl expose deployment NAME --port=<port>`,
  - supports `--target-port`, `--type`, `--name`, `--selector`, `--node-port`,
  - service creation remains declarative; endpoints/network runtime are reconciled asynchronously by the network controller.
- `kubectl ingress` baseline:
  - supports `Ingress` manifests in `kubectl apply -f` / `kubectl create -f`,
  - supports `kubectl get ingress`, `kubectl describe ingress`, `kubectl delete ingress`,
  - supports `kubectl get ingressclass` (empty output when no class is present),
  - scope is API/object simulation only (no L7 dataplane routing or external `ADDRESS` assignment without controller).
- Network simulation baseline:
  - dedicated runtime module (`src/core/network/`) computes service runtime state (ClusterIP, NodePort, endpoints),
  - `kubectl exec ... -- nslookup <service>.<namespace>.svc.cluster.local` resolves Service DNS records,
  - `kubectl exec ... -- curl <url>` simulates in-cluster service traffic,
  - `kubectl run ... --rm -it --command -- nslookup|curl ...` supports short-lived diagnostics flows.
- `kubectl get --raw` baseline:
  - supports discovery root (`/`) and namespaces list (`/api/v1/namespaces`),
  - supports OpenAPI/networking inspection endpoints used by conformance (`/openapi/v3`, `/apis/networking.k8s.io/v1`, `/openapi/v3/apis/networking.k8s.io/v1`).
- Volumes simulation baseline:
  - support runtime `emptyDir`, `hostPath`, `persistentVolumeClaim` au niveau Pod,
  - support ressources `PersistentVolume` / `PersistentVolumeClaim` avec phases de base (`Available`, `Pending`, `Bound`),
  - binding statique PV/PVC event-driven (controller dédié),
  - gate lifecycle: un Pod avec PVC non bound reste `Pending` avec raison explicite (`waitingReason`).
- `kubectl cluster-info` baseline:
  - includes control-plane and CoreDNS lines,
  - `kubectl cluster-info dump --output-directory <path>` returns a success confirmation message.

### Shell

pwd, ls, cd, mkdir (-p), touch, cat, rm (-r), nano/vi/vim, clear, help, debug. Détail : voir `src/core/shell/`.

### Terminal Features

- **Command history**: Navigate with ↑↓ (max 100 commands)
- **Tab autocompletion**: Bash-like autocomplete for commands, resources, files, flags
- **Enhanced prompt**: Format `~/path>` with dynamic path
- **Persistent state**: Cluster and filesystem saved to localStorage
- **Full-screen mode**: Terminal only, like real exam environment
- **Cluster viewer**: Collapsible panel below terminal showing nodes, pods, and containers visually

## UI Philosophy

### Full Terminal Experience

L'examen CKA/CKAD est 100% terminal. Notre simulateur doit reproduire cette expérience :

- ✅ Terminal uniquement (pas de GUI pour le cluster)
- ✅ Éditeur in-terminal (nano/vim émulé)
- ✅ Pas d'explorateur de fichiers graphique
- ✅ Navigation par commandes shell

### Ce qu'on NE fait PAS pour l'instant

- ❌ Éditeur externe (CodeMirror, Monaco)
- ❌ Vue explorateur de fichiers graphique
- ❌ Stockage cluster sur Supabase (localStorage suffit)
- ❌ Interface graphique pour manipuler les ressources

## User Capabilities

### 1. Explore Pre-configured Cluster

- View existing pods, deployments, services
- Inspect resource details with `describe`
- Check pod logs
- Navigate namespaces

### 2. Manage Filesystem

- Navigate virtual filesystem (max 3 levels depth)
- Create directories and YAML files
- View file contents with `cat`
- Edit files with `nano` or `vim` (in-terminal)

### 3. Create and Apply Resources

- Write YAML manifests in terminal editor
- Apply manifests to cluster: `kubectl apply -f <file>`
- See resources created in real-time
- Modify and reapply configurations

### 4. Debug and Troubleshoot

- Check pod status and events
- View container logs
- Execute commands in pods (`kubectl exec`)
- Use `debug` command for application logs

### 5. Experiment Safely

- All operations are local and isolated
- Reset cluster to seed state
- No risk of breaking real systems
- Immediate feedback

### 6. Complete Lesson Quizzes

- Interactive quizzes at the end of each lesson
- Multiple question types: multiple-choice, terminal commands
- Questions displayed sequentially in the same component
- Visual feedback for correct/incorrect answers
- Must answer all questions correctly to complete the quiz
- Terminal integration: quiz validates commands executed in the terminal
- No strict blocking: users can manually navigate to next lesson URL
- Button dynamically changes: "Next Question" → "Next Lesson" when quiz is completed

## Quiz System

### Quiz Features

- **Declarative Definition**: Quizzes are defined in `quiz.ts` files within lesson directories
- **Multiple Question Types**:
  - **Multiple Choice**: Select one correct answer from options
  - **Terminal Command**: Execute a command in the terminal to validate
  - **Extensible**: Architecture supports future question types (order, fill-in-the-blank, etc.)

### Quiz Flow

1. User reads lesson content
2. Quiz appears at the bottom of the lesson
3. Questions are displayed one after another in the same component
4. User must answer correctly to proceed to next question
5. Incorrect answers are highlighted in red
6. Once all questions are answered correctly, "Next Lesson" button becomes available
7. Quiz completion status is tracked (but results are not stored yet)

### Quiz Validation

- **Multiple Choice**: Immediate validation on selection
- **Terminal Command**: Automatic validation when command is executed
- **Visual Feedback**:
  - Red border/background for incorrect answers
  - Green border/background for correct answers
- **Progression**: Cannot proceed to next question until current one is correct

### Quiz Integration

- Quiz is displayed at the very bottom of lesson content
- Navigation button changes dynamically:
  - "Next Question" when quiz is active and not completed
  - "Next Lesson" when quiz is completed or no quiz exists
- Terminal commands are automatically relayed to quiz for validation
- No strict blocking: manual URL navigation is allowed

## Data Models

### Cluster State

```typescript
interface ClusterState {
  namespaces: Namespace[]
  pods: Pod[]
  replicaSets: ReplicaSet[] // Managed by ReplicaSetController
  deployments: Deployment[] // Managed by DeploymentController
  daemonSets: DaemonSet[]
  services: Service[]
  ingresses: Ingress[]
  configMaps: ConfigMap[]
  secrets: Secret[]
  persistentVolumes: PersistentVolume[]
  persistentVolumeClaims: PersistentVolumeClaim[]
}
```

Cluster initialization always goes through a centralized bootstrap policy:

- Single entry point: `createClusterState(...)` (`src/core/cluster/ClusterState.ts`)
- Explicit options:
  - `profile`: `kind-like` | `none`
  - `mode`: `always` | `missing-only` | `never`
- Bootstrap resources are implemented in `src/core/cluster/systemBootstrap.ts` and shared across runner, seed loader, and emulated environment manager.
- System workloads are modeled by a dedicated simulation component (`SimSystemWorkloadsController`) with static-control-plane, daemonset-like, and deployment-like behaviors.
- System workload policy `conformance` targets CoreDNS on control-plane to mirror reference outputs captured in `artifacts/conformance/kind.log`.
- Scheduler predicates include taints/tolerations, nodeSelector, and required nodeAffinity for closer Kubernetes placement behavior.
- Pod IP assignment is centralized (`SimPodIpAllocator`) to avoid collisions and keep `get/describe` outputs coherent.

### Controller Hierarchy

```
Deployment
    └── creates/manages → ReplicaSet (via ownerReferences)
                              └── creates/manages → Pod (via ownerReferences)
```

Les controllers réagissent aux événements et reconcilent l'état :

- `DeploymentController` : observe DeploymentCreated/Updated/Deleted, crée des ReplicaSets
- `ReplicaSetController` : observe ReplicaSetCreated/Updated/Deleted, crée des Pods

### Filesystem State

```typescript
interface FileSystemState {
  currentPath: string
  tree: DirectoryNode
}
```

### Persistence

- **localStorage only** : Simple, synchrone, suffisant
- Pas de Supabase pour le cluster (trop complexe, pas nécessaire)
- Reset possible à tout moment

### Filesystem Constraints

- **Max depth**: 3 levels (root + 3)
- **Allowed extensions**: `.yaml`, `.yml`, `.json`, `.kyaml`
- **Forbidden characters**: `*`, `?`, `<`, `>`, `|`, spaces
- **Path format**: Unix-style (`/path/to/file`)

## Seed System

Environnements seedés côté cours dans `src/courses/seeds/` : `minimal.ts`, `demo.ts`, registry dans `getSeed.ts`. Les seeds fournissent le filesystem; la topologie cluster est bootstrapée par la policy runtime unique (`createClusterState(..., { bootstrap })`). Seed par chapitre : `chapter.json` → `"environment": "minimal"` (ou `"demo"`, etc.) ; défaut `minimal` si absent. Voir `src/courses/seeds/README.md`.

## UI Layout

### Terminal Only Mode (Default)

- Terminal centered, full-width
- Dark theme (exam-like)
- Minimal chrome
- Responsive

### Learning Mode (Current)

- Split-view: Course content (left) + Terminal with Cluster Viewer (right)
- Collapsible sidebar with course outline (left)
- Collapsible cluster viewer panel below terminal (bottom right)
- Cluster viewer displays nodes, pods, and containers in a nested visual diagram
- Smooth animations for panel open/close transitions

#### Layout Overview

Three-column layout with collapsible panels:

- **Plan du cours** (left): Course outline, collapses horizontally (↔)
- **Cours** (center): Main lesson content, always visible
- **Terminal** (top right): Interactive terminal for kubectl commands
- **Visualisation cluster** (bottom right): Node/pod diagram, collapses vertically (↕)

```
┌─────────┬──────────────────────┬─────────────────┐
│  Plan   │                      │    Terminal     │
│   du  ↔ │       Cours          │                 │
│  cours  │                      ├─────────────────┤
│         │                      │  Visualisation  │
│         │                      │    cluster ↕    │
└─────────┴──────────────────────┴─────────────────┘
```

## Success Criteria (MVP) ✅

All MVP criteria have been met:

- ✅ Terminal functional and styled
- ✅ Command history with ↑↓ navigation
- ✅ Tab autocompletion working
- ✅ Enhanced prompt with kube icon and path
- ✅ 14+ kubectl commands supported (get, describe, delete, create, apply, run, logs, exec, label, annotate, version, cluster-info, api-resources)
- ✅ Shell commands functional (cd, ls, pwd, mkdir, touch, cat, rm, nano/vi/vim)
- ✅ Virtual filesystem with max 3 levels
- ✅ Cluster persists between sessions (localStorage)
- ✅ kubectl + filesystem integration
- ✅ Simulated logs for pods
- ✅ Multi-container pods and init containers
- ✅ In-terminal editor (nano/vim emulation)
- ✅ Quiz system with multiple question types
- ✅ Terminal command validation in quizzes
- ✅ Tests à migrer (Vitest, coverage cible ~94%)
- ✅ TypeScript strict mode
- ✅ Modular architecture

Contenu cours : `src/content/` (facades), `src/courses/` (structure, markdown leçons). Quiz et overview : données build-time, `getLessonContent` / facades.

## References

- `architecture.md` — structure technique
- `conventions.md` — standards de code
- `roadmap.md` — phases et features futures
- `marketing.md` — business (business/)
