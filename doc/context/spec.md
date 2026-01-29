# Specification - Kube Mastery

## Vision

Interactive web application for learning `kubectl` commands through a simulated terminal with a stateful virtual Kubernetes cluster.

**Philosophy**: Full terminal experience, like the real CKA/CKAD exam.

## Project Objectives

### Phase 1: MVP ✅ (Completed)
- Functional terminal with xterm.js (centered, styled)
- kubectl command interpreter (get, describe, delete, create, apply, logs, exec, label, annotate, version, cluster-info, api-resources)
- Stateful virtual cluster (namespaces, pods, deployments, services, configmaps, secrets)
- Local persistence (localStorage with auto-save)
- Virtual filesystem for YAML manifests
- Multi-container pods and init containers support
- In-terminal editor (nano/vim emulation)

> For Phase 2 and Phase 3 objectives, see [roadmap.md](roadmap.md)

## Core Features

### kubectl Commands (Phase 1 - Implemented)

| Command                                        | Description                                  |
| ---------------------------------------------- | -------------------------------------------- |
| `kubectl get pods`                             | List pods                                    |
| `kubectl get pods -n <ns>`                     | List pods by namespace                       |
| `kubectl get deployments` / `deploy`           | List deployments                             |
| `kubectl get replicasets` / `rs`               | List replicasets                             |
| `kubectl get services/configmaps/secrets`      | List resources                               |
| `kubectl describe <type> <name>`               | Show resource details                        |
| `kubectl delete <type> <name>`                 | Delete resource                              |
| `kubectl create -f <file>`                     | Create from YAML                             |
| `kubectl apply -f <file>`                      | Apply YAML manifest                          |
| `kubectl logs <pod>`                           | Show pod logs                                |
| `kubectl logs <pod> -n <ns>`                   | Logs with namespace                          |
| `kubectl exec -it <pod> -- <cmd>`              | Execute command in pod                       |
| `kubectl label <type> <name> <key>=<value>`    | Add/update labels                            |
| `kubectl annotate <type> <name> <key>=<value>` | Add/update annotations                       |
| `kubectl version`                              | Show client and server version               |
| `kubectl version --client`                     | Show client version only                     |
| `kubectl version --output json`                | Show version in JSON format                  |
| `kubectl version --output yaml`                | Show version in YAML format                  |
| `kubectl cluster-info`                         | Display cluster information                  |
| `kubectl cluster-info dump`                    | Dump cluster information                     |
| `kubectl api-resources`                        | List API resources                           |
| `kubectl api-resources --output wide`          | List API resources with VERBS and CATEGORIES |
| `kubectl api-resources --namespaced=true`      | Filter namespaced resources                  |
| `kubectl api-resources --sort-by=name`         | Sort resources by name                       |

### Shell Commands (Phase 1 - Implemented)

| Command                                  | Description                       |
| ---------------------------------------- | --------------------------------- |
| `pwd`                                    | Show current directory            |
| `ls`, `ls -l`                            | List files/directories            |
| `cd <path>`                              | Change directory                  |
| `mkdir <dir>`, `mkdir -p <path>`         | Create directory                  |
| `touch <file>`                           | Create empty file                 |
| `cat <file>`                             | Display file content              |
| `rm <file>`, `rm -r <dir>`               | Remove files/directories          |
| `nano <file>`, `vi <file>`, `vim <file>` | Edit files in terminal (emulated) |
| `clear`                                  | Clear terminal                    |
| `help`                                   | Show help                         |
| `debug`                                  | Show application logs             |

### Terminal Features

- **Command history**: Navigate with ↑↓ (max 100 commands)
- **Tab autocompletion**: Bash-like autocomplete for commands, resources, files, flags
- **Enhanced prompt**: Format `☸ ~/path>` with dynamic path
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
  replicaSets: ReplicaSet[]    // Managed by ReplicaSetController
  deployments: Deployment[]    // Managed by DeploymentController
  services: Service[]
  configMaps: ConfigMap[]
  secrets: Secret[]
}
```

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

Les environnements (cluster + filesystem) sont définis par des scénarios dans `seeds/`.

Scénarios disponibles : `empty`, `default`, `troubleshooting`, `multi-namespace`.

Défini dans `chapter.json` avec `"environment": "minimal"`. Si omis, `empty` est utilisé.

Voir [seeds/readme.md](/seeds/readme.md) pour les détails.

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
- ✅ Enhanced prompt with ☸ icon and path
- ✅ 13+ kubectl commands supported (get, describe, delete, create, apply, logs, exec, label, annotate, version, cluster-info, api-resources)
- ✅ Shell commands functional (cd, ls, pwd, mkdir, touch, cat, rm, nano/vi/vim)
- ✅ Virtual filesystem with max 3 levels
- ✅ Cluster persists between sessions (localStorage)
- ✅ kubectl + filesystem integration
- ✅ Simulated logs for pods
- ✅ Multi-container pods and init containers
- ✅ In-terminal editor (nano/vim emulation)
- ✅ Quiz system with multiple question types
- ✅ Terminal command validation in quizzes
- ✅ Test coverage ~94%
- ✅ TypeScript strict mode
- ✅ Modular architecture

## References

- See `architecture.md` for technical structure
- See `conventions.md` for coding standards
- See `roadmap.md` for development phases and future features
- See `marketing.md` for business model
