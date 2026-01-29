# Ajouter une ressource Kubernetes

Checklist complète pour intégrer une nouvelle ressource Kubernetes dans le système.

## 1. Modèle TypeScript

**Fichier:** `src/core/cluster/ressources/{Resource}.ts`

- Définir interfaces TypeScript (basées sur OpenAPI)
- Créer factory `create{Resource}()`
- Ajouter helpers (ex: `get{Resource}Status()`, `get{Resource}Roles()`)
- Créer `parse{Resource}Manifest()` avec validation Zod
- Exporter types et fonctions

**Référence:** `Node.ts`, `Pod.ts`, `ConfigMap.ts`, `Secret.ts`

## 2. ClusterState

**Fichier:** `src/core/cluster/ClusterState.ts`

- Ajouter `{resources}: ResourceCollection<{Resource}>` dans `ClusterStateData`
- Créer repository: `const {resource}Repo = createResourceRepository<{Resource}>('{Resource}')`
- Créer operations: `const {resource}Ops = createResourceOperations({resource}Repo, getState, setState, bus)`
- Ajouter méthodes dans l'interface `ClusterState`:
  - `get{Resources}(): {Resource}[]`
  - `add{Resource}(resource: {Resource}): void`
  - `find{Resource}(name: string, namespace: string): Result<{Resource}>`
  - `delete{Resource}(name: string, namespace: string): Result<{Resource}>`
  - `update{Resource}(name: string, namespace: string, updateFn: (r: {Resource}) => {Resource}): Result<{Resource}>`
- Implémenter méthodes (utiliser `createFacadeMethods()` pour namespaced, ou méthodes custom pour cluster-scoped)
- Mettre à jour `createEmptyState()`: inclure `{resources: { items: [] }}`
- Mettre à jour `toJSON()`: inclure `{resources: { items: [...state.{resources}.items] }}`
- Mettre à jour `loadState()`: inclure `{resources: newState.{resources} || { items: [] }}`

**Note cluster-scoped:** Si ressource sans namespace (ex: Node), utiliser `namespace: ''` et ignorer namespace dans `find`/`delete`/`update`.

## 3. Événements (optionnel si pas encore implémenté)

**Fichiers:** 
- `src/core/cluster/events/types.ts`
- `src/core/cluster/events/handlers.ts`
- `src/core/cluster/ClusterState.ts`

Si événements pas encore créés:
- Utiliser événements placeholder (ex: `createSecretCreatedEvent()`)
- Ajouter directement au state dans `add{Resource}()` (bypass events)
- Ajouter handlers dans `EVENT_HANDLERS` quand événements seront créés

**Référence:** Node utilise placeholders pour l'instant.

## 4. Parser YAML

**Fichier:** `src/core/kubectl/yamlParser.ts`

- Ajouter `{Resource}` à `ParsedResource` type
- Ajouter `'{Resource}'` à `ResourceKind` type
- Ajouter dans `isSupportedKind()`: `kind === '{Resource}'`
- Ajouter dans `MANIFEST_PARSERS`: `'{Resource}': parse{Resource}Manifest`

**Fichier:** `src/core/cluster/seeds/loader.ts`

- Ajouter `{Resource}` aux types de retour de `parseYamlDocument()` et `parseMultiDocumentYaml()`

## 5. Handler kubectl get

**Fichier:** `src/core/kubectl/commands/handlers/get.ts`

- Importer `{Resource}` et helpers
- Ajouter dans `RESOURCE_HANDLERS`:
  ```typescript
  '{resources}': {
      getItems: (state) => state.{resources}.items,
      headers: ['name', 'status', 'age'],
      formatRow: (resource: {Resource}) => [...],
      supportsFiltering: true,
      isClusterScoped: false, // true si pas de namespace
      formatRowWide?: (resource: {Resource}) => [...],
      headersWide?: string[]
  }
  ```
- Ajouter formatters JSON/YAML si nécessaire: `format{Resources}Json()`, `format{Resources}Yaml()`

## 6. Types kubectl

**Fichier:** `src/core/kubectl/commands/types.ts`

- Ajouter `'{resources}'` au type `Resource`

## 7. Parser kubectl

**Fichier:** `src/core/kubectl/commands/parser.ts`

- Ajouter dans `KUBECTL_RESOURCES`:
  ```typescript
  '{resources}': ['{resources}', '{resource}', '{alias}']
  ```

## 8. Autocomplete

**Fichier:** `src/core/kubectl/autocomplete/KubectlAutocompleteProvider.ts`

- Ajouter dans `RESOURCE_ALIASES`:
  ```typescript
  '{resources}': '{resources}',
  '{resource}': '{resources}',
  '{alias}': '{resources}'
  ```
- Mettre à jour `getResourceNames()` pour inclure `context.clusterState.get{Resources}()`
- Vérifier `KUBECTL_ACTIONS` si nécessaire

## 9. Resource Helpers

**Fichier:** `src/core/kubectl/commands/handlers/resourceHelpers.ts`

- Ajouter `{Resource}` au type `KubernetesResource`
- Dans `applyResourceWithEvents()`:
  ```typescript
  else if (kind === '{Resource}') {
      existing = clusterState.find{Resource}(name, namespace)
  }
  // ...
  else if (kind === '{Resource}') {
      clusterState.add{Resource}(resource as {Resource})
  }
  ```
- Dans `createResourceWithEvents()`: même logique

## 10. Seeds/Exemples

**Fichier:** `seeds/k8s/{type}/{resources}.yaml`

- Créer fichier YAML avec exemples de ressources
- Format conforme à OpenAPI spec

## 11. Tests

**Fichiers:**
- `tests/unit/cluster/ressources/{Resource}.test.ts` - Modèle et helpers
- `tests/unit/kubectl/commands/handlers/get.test.ts` - Handler get
- `tests/unit/kubectl/autocomplete/KubectlAutocompleteProvider.test.ts` - Autocomplete

## 12. Golden Files (optionnel)

**Fichiers:**
- `bin/config/golden-tests.ts` - Ajouter catégorie `'{resources}'`
- `bin/generate-golden-files.ts` - Valider catégorie
- `refs/golden-files/{resources}/` - Générer fichiers de référence

## 13. Controller (si ressource workload)

**Fichier:** `src/core/cluster/controllers/{Resource}Controller.ts`

Si la ressource gère d'autres ressources (ex: Deployment → ReplicaSet → Pod):

1. Définir `WATCHED_EVENTS` - les événements à observer
2. Importer et utiliser les helpers partagés:
   ```typescript
   import {
       createOwnerRef,        // Crée un ownerReference pour un enfant
       findOwnerByRef,        // Trouve le parent via ownerReferences
       getOwnedResources,     // Trouve les enfants via ownerReferences
       statusEquals,          // Compare deux status
       subscribeToEvents,     // S'abonne à des événements spécifiques
       generateSuffix,        // Génère un suffixe aléatoire
   } from './helpers'
   import type { Controller, ControllerState } from './types'
   ```
3. Implémenter `Controller` interface avec `start()` et `stop()`
4. Utiliser `subscribeToEvents()` au lieu de `subscribeAll()` pour performance
5. Créer les enfants avec `ownerReferences: [createOwnerRef(parent)]`
6. Utiliser `getOwnedResources()` pour trouver les enfants
7. Utiliser `findOwnerByRef()` pour mettre à jour le status du parent
8. Ajouter dans `initializeControllers()` (`controllers/index.ts`)

**Référence:** `DeploymentController.ts`, `ReplicaSetController.ts`

## Checklist rapide

- [ ] Modèle TypeScript créé
- [ ] ClusterState mis à jour (collection, repository, méthodes)
- [ ] Parser YAML mis à jour
- [ ] Handler `kubectl get` implémenté
- [ ] Types `Resource` mis à jour
- [ ] Parser `KUBECTL_RESOURCES` mis à jour
- [ ] Autocomplete mis à jour
- [ ] Resource helpers mis à jour
- [ ] Seeds créés
- [ ] Tests ajoutés
- [ ] Controller créé (si workload)
- [ ] Compilation TypeScript OK
- [ ] Commande `kubectl get {resources}` fonctionne
