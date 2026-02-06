# Kubelet Simulator

## Contexte

Actuellement, le **Scheduler** fait deux choses :

1. Assigne `spec.nodeName` au pod
2. Passe le pod en `status.phase: Running`

Dans Kubernetes réel, c'est le **Kubelet** (qui tourne sur chaque node) qui gère le lifecycle des pods après le scheduling.

## Objectif

Séparer les responsabilités :

- **Scheduler** : assigne uniquement `spec.nodeName`
- **Kubelet** : gère le démarrage des containers et met à jour `status.phase`

## Architecture cible

```
Pod créé (phase: Pending, nodeName: undefined)
    ↓
Scheduler détecte pod sans nodeName
    ↓
Scheduler assigne nodeName (phase reste Pending)
    ↓
Kubelet détecte pod assigné à son node
    ↓
Kubelet "démarre" les containers
    ↓
Kubelet met phase: Running + containerStatuses
```

## Implémentation

### 1. Modifier le Scheduler

Dans `src/core/cluster/scheduler/Scheduler.ts`, fonction `bind()` :

- Retirer la modification de `status.phase`
- Ne modifier que `spec.nodeName`

### 2. Créer le Kubelet

Nouveau fichier `src/core/cluster/kubelet/Kubelet.ts` :

```typescript
interface Kubelet {
  nodeName: string
  start(): void
  stop(): void
}
```

Responsabilités :

- **Watch** les `PodUpdated` où `spec.nodeName === this.nodeName`
- **Simuler** le démarrage (optionnel : délai pour réalisme)
- **Émettre** `PodUpdated` avec :
  - `status.phase: Running`
  - `status.containerStatuses` (état des containers)
  - `status.conditions` (PodScheduled, Initialized, Ready, ContainersReady)

### 3. Options d'architecture

**Option A : Un Kubelet par node**

- Plus fidèle à K8s
- Chaque Kubelet ne gère que "son" node
- Plus de code, mais meilleure isolation

**Option B : KubeletSimulator global**

- Un seul composant qui simule tous les kubelets
- Plus simple à implémenter
- Filtre les pods par nodeName en interne

Recommandation : **Option B** pour commencer (simplicité), refactor vers Option A si besoin.

### 4. Intégration

Dans `EmulatedEnvironmentManager.ts` :

```typescript
initializeControllers(eventBus, clusterState)
initializeScheduler(eventBus, clusterState)
initializeKubelet(eventBus, clusterState) // Nouveau
```

### 5. Tests

Créer `tests/unit/cluster/kubelet/Kubelet.test.ts` :

- Pod assigné à un node → passe en Running
- Pod sans nodeName → ignoré
- Pod déjà Running → ignoré
- ContainerStatuses mis à jour correctement

## Évolutions futures

- **Health checks** : simuler liveness/readiness probes
- **Container lifecycle** : Waiting → Running → Terminated
- **Restart policy** : gérer les restarts
- **Resource tracking** : CPU/mémoire utilisés sur le node
