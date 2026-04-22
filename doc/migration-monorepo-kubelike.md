# Migration Monorepo 100% Kube-like

## Objectif

Migrer `kube-mastery` vers une organisation interne très proche de Kubernetes, tout en restant dans un seul monorepo.

Objectifs principaux:

- Séparer clairement `cmd`, `pkg`, `staging`, `test`, `hack`.
- Préparer une extraction future repo par repo sans refonte.
- Réduire le couplage entre moteur Kubernetes simulé et application web.
- Garder le produit web fonctionnel pendant toute la migration.

## Principes d'architecture

- `cmd/*` contient uniquement les entrées binaires.
- `pkg/*` contient l'implémentation interne non exportée.
- `staging/src/k8s.io/*` contient les modules exportables.
- `test/*` contient les suites transverses.
- `apps/web` consomme les APIs publiques, sans import interne non contractuel.

## Structure cible

```text
apps/
  web/

packages/
  cmd/
    kube-apiserver/
    kube-controller-manager/
    kube-scheduler/
    kubelet/
    kubectl/
    kube-conformance/

  pkg/
    apiserver/
    registry/
    controller/
    scheduler/
    kubelet/
    kubectl/
    runtime/
    network/
    volume/
    storage/
    proxy/
    kubeadm/
    cri/

  staging/
    src/
      k8s.io/
        api/
        apimachinery/
        apiserver/
        client-go/
        kubectl/
        kubelet/
        kube-scheduler/
        kube-controller-manager/
        kube-proxy/
        cri-api/
        cri-client/
        kubeadm/
        conformance/

  test/
    e2e/
    conformance/
    integration/
    fixtures/

  hack/
  build/
```

## Règles de dépendances

Règles strictes:

- `staging/src/k8s.io/api` et `staging/src/k8s.io/apimachinery` ne dépendent pas de `pkg`.
- `pkg/*` peut dépendre de `staging/src/k8s.io/*`.
- `cmd/*` dépend de `pkg/*` et de `staging/src/k8s.io/*`, jamais l'inverse.
- `apps/web` dépend uniquement des APIs publiques de `staging/src/k8s.io/*` ou de façades explicitement exposées.
- Aucun package `staging/src/k8s.io/*` ne dépend de `apps/web`.

Règle de publication:

- Tout ce qui est dans `staging/src/k8s.io/*` doit pouvoir être extrait tel quel dans un repo dédié.

## Mapping depuis l'existant

### Source actuelle -> cible

- `src/core/cluster/ressources/*` -> `packages/staging/src/k8s.io/api`
- `src/core/shared/*` (métadonnées, selectors, utilitaires API) -> `packages/staging/src/k8s.io/apimachinery`
- `src/core/api/*` -> `packages/pkg/apiserver` + `packages/staging/src/k8s.io/apiserver`
- `src/core/control-plane/controllers/*` -> `packages/pkg/controller`
- `src/core/control-plane/controllers/SchedulerController.ts` + `src/core/cluster/scheduler/*` -> `packages/pkg/scheduler` + `packages/staging/src/k8s.io/kube-scheduler`
- `src/core/kubelet/*` -> `packages/pkg/kubelet` + `packages/staging/src/k8s.io/kubelet`
- `src/core/kubectl/*` -> `packages/pkg/kubectl` + `packages/staging/src/k8s.io/kubectl`
- `src/core/network/*` -> `packages/pkg/network` + `packages/pkg/proxy` + `packages/staging/src/k8s.io/kube-proxy`
- `src/core/volumes/*` -> `packages/pkg/volume`
- `src/core/runtime/*` -> `packages/pkg/runtime` + `packages/pkg/cri` + `packages/staging/src/k8s.io/cri-api` + `packages/staging/src/k8s.io/cri-client`
- `conformance/*` + `tests/conformance/*` -> `packages/staging/src/k8s.io/conformance` + `packages/test/conformance`
- `bin/*` scripts runtime/parity -> `packages/cmd/kube-conformance` + `packages/hack`

## Volet terminal unix-like

Objectif:

- Réorganiser la couche terminal/shell avec une structure unix-like.
- Conserver le comportement existant, migration d'organisation uniquement.
- Préparer un export futur du terminal comme module indépendant.

Structure cible recommandée:

```text
packages/pkg/terminal/
  tty/
    driver/
    adapters/
  shell/
    parser/
    executor/
    builtins/
    jobs/
  proc/
    session/
    signals/
  fs/
    posix/
  commands/
    bin/
    net/
    editor/
  cli/
    kubectl-bridge/
```

Règles de séparation:

- `tty/*` ne contient pas de logique métier kubectl/shell.
- `shell/builtins/*` contient les commandes qui modifient l'état de session (`cd`, `exit`, `env`).
- `commands/bin/*` contient les commandes classiques (`ls`, `cat`, `grep`, `wc`, `mkdir`, `rm`, `mv`, `touch`).
- `commands/net/*` contient les commandes réseau (`curl`, `nslookup`).
- `cli/kubectl-bridge/*` isole l'intégration shell <-> kubectl.
- `proc/session/*` et `proc/signals/*` gèrent contexte, interruption, flux, verrous d'entrée.

Mapping initial terminal/shell:

- `src/core/terminal/TerminalManager.ts` -> `packages/pkg/terminal/tty/adapters/`
- `src/core/terminal/renderer/*` -> `packages/pkg/terminal/tty/driver/`
- `src/core/terminal/core/CommandDispatcher.ts` -> `packages/pkg/terminal/shell/executor/`
- `src/core/terminal/core/handlers/ShellCommandHandler.ts` -> `packages/pkg/terminal/shell/executor/`
- `src/core/terminal/core/ShellContext.ts` -> `packages/pkg/terminal/proc/session/`
- `src/core/terminal/kubectl/*` -> `packages/pkg/terminal/cli/kubectl-bridge/`
- `src/core/shell/commands/core/*` -> `packages/pkg/terminal/shell/parser/` + `shell/executor/`
- `src/core/shell/commands/handlers/navigation/*` -> `packages/pkg/terminal/shell/builtins/`
- `src/core/shell/commands/handlers/system/env.ts` et `exit.ts` -> `packages/pkg/terminal/shell/builtins/`
- `src/core/shell/commands/handlers/fileops/*` -> `packages/pkg/terminal/commands/bin/`
- `src/core/shell/commands/handlers/network/*` -> `packages/pkg/terminal/commands/net/`
- `src/core/shell/commands/handlers/editor/*` -> `packages/pkg/terminal/commands/editor/`

## Phases de migration

## Phase 0, Préparation

- Créer l'arborescence cible vide.
- Ajouter les aliases TS pour nouvelles racines.
- Ajouter une règle d'import bloquante pour éviter nouveaux imports `src/core/*`.
- Geler les refactors non liés à la migration.

Critère de sortie:

- Build existant inchangé.
- Arborescence cible présente.

## Phase 1, Fondations API

- Migrer `api` et `apimachinery` en premier.
- Introduire des barrels publics minimaux.
- Mettre en place des tests unitaires de non-régression sur les types.

Critère de sortie:

- Tous les imports de types passent par `staging/src/k8s.io/api` ou `staging/src/k8s.io/apimachinery`.

## Phase 2, Apiserver et Runtime coeur

- Migrer `ApiServerFacade`, stockage, watch, events.
- Migrer contrôleurs workload dans `pkg/controller`.
- Migrer scheduler dans `pkg/scheduler`.
- Migrer kubelet dans `pkg/kubelet`.

Critère de sortie:

- Le cluster simulé démarre via les nouveaux chemins sans fallback legacy.

## Phase 3, Kubectl et Terminal

- Migrer parser/executor/handlers kubectl.
- Ajouter `cmd/kubectl` comme point d'entrée unique.
- Brancher `apps/web` sur la nouvelle façade kubectl.
- Démarrer la migration unix-like terminal:
  - extraire `tty` (renderer/input/prompt),
  - isoler `shell kernel`,
  - séparer `builtins` et `commands`.

Critère de sortie:

- Les commandes kubectl déjà couvertes restent vertes.
- Le terminal fonctionne avec la nouvelle arborescence sans régression visible.

## Phase 4, Réseau, Volumes, CRI, Proxy, Kubeadm

- Migrer `network`, `volumes`, `runtime`.
- Introduire `cri-api` puis `cri-client`.
- Isoler la logique `kube-proxy`.
- Isoler bootstrap cluster dans `kubeadm`.

Critère de sortie:

- Scénarios réseau et stockage existants restent passants.

## Phase 5, Conformance et outillage

- Migrer conformance OpenAPI + parity runtime.
- Créer `cmd/kube-conformance`.
- Déplacer scripts vers `hack/` avec conventions stables.
- Finaliser la migration unix-like terminal:
  - déplacer `proc/session` et `proc/signals`,
  - basculer `kubectl-bridge`,
  - supprimer les re-exports legacy terminal/shell.

Critère de sortie:

- `npm run conformance` continue de fonctionner avec la nouvelle arborescence.
- Les imports `src/core/terminal/*` et `src/core/shell/*` legacy sont supprimés.

## Compatibilité pendant migration

Stratégie recommandée:

- Utiliser une couche de compatibilité temporaire avec re-export.
- Supprimer les chemins legacy seulement quand 100% des imports ont basculé.
- Interdire les nouveaux imports legacy dès la phase 1.

## Plan de validation

À exécuter à chaque phase:

- `npm run test`
- `npm run conformance:list`
- `npm run conformance -- --quiet`
- tests ciblés des modules déplacés

Validation architecture:

- Vérifier absence d'import interdit entre couches.
- Vérifier que `apps/web` ne touche pas `pkg/*` en direct.

## Risques et mitigations

- Risque: explosion des imports cassés.
  - Mitigation: migration package par package avec re-exports temporaires.

- Risque: régressions fonctionnelles kubectl.
  - Mitigation: exécuter parity runner à chaque étape majeure.

- Risque: dette de compatibilité durable.
  - Mitigation: ticket de suppression des shims à la fin de chaque phase.

## Décisions de nommage

Noms retenus:

- Cible interne: `packages/staging/src/k8s.io/*`
- Packages futurs extractibles: `k8s.io/<module>`
- Modules runtime simulés restent internes dans `packages/pkg/*` tant que contrat non stabilisé.

## Checklist d'exécution

- [ ] Phase 0 terminée
- [ ] Phase 1 terminée
- [ ] Phase 2 terminée
- [ ] Phase 3 terminée
- [ ] Phase 4 terminée
- [ ] Phase 5 terminée
- [ ] Suppression des chemins legacy
- [ ] Documentation des nouveaux points d'entrée
