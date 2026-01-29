# Store clé-valeur interne (etcd-like)

## Objectif

Transformer `ClusterStateData` en un store clé-valeur hiérarchique similaire à etcd, avec une API de requête flexible pour supporter kubectl, etcdctl (futur), et des accès directs.

## Architecture actuelle vs nouvelle

### Architecture actuelle

```
ClusterStateData {
  pods: ResourceCollection<Pod>
  configMaps: ResourceCollection<ConfigMap>
  secrets: ResourceCollection<Secret>
}

ClusterState {
  getPods(namespace?)
  findPod(name, namespace)
  addPod(pod)
  ...
}
```

**Problèmes** :
- Accès spécifique par type de ressource (getPods, getConfigMaps, etc.)
- Pas de requêtes génériques
- Pas de support pour etcdctl (futur)
- Difficile d'ajouter de nouvelles ressources

### Nouvelle architecture

```
EtcdStore {
  get(key: string): Result<Resource>
  put(key: string, value: Resource): void
  list(prefix: string): Resource[]
  delete(key: string): Result<Resource>
  watch(prefix: string, callback): UnsubscribeFn
}

QueryAPI {
  getResource(kind, name, namespace): Result<Resource>
  listResources(kind, options): Resource[]
  query(options): Resource[]
}
```

**Avantages** :
- Store générique (comme etcd)
- API de requête flexible
- Support futur pour etcdctl
- Facile d'ajouter de nouvelles ressources
- Plus proche d'un vrai cluster Kubernetes

## Structure des clés (format etcd)

### Format hiérarchique

Les clés suivent le format etcd de Kubernetes :

```
/registry/{resource-kind}/{namespace}/{name}
```

**Exemples** :
- `/registry/pods/default/nginx`
- `/registry/configmaps/default/app-config`
- `/registry/secrets/kube-system/default-token`
- `/registry/events/default/pod.1234567890.abc123`

### Règles de nommage

- **Resource kind** : pluriel en minuscules (`pods`, `configmaps`, `secrets`, `events`)
- **Namespace** : nom du namespace (ou `_cluster` pour les ressources cluster-scoped)
- **Name** : nom de la ressource Kubernetes

### Cas spéciaux

- **Ressources cluster-scoped** : `/registry/namespaces/_cluster/default`
- **Événements** : `/registry/events/{namespace}/{name}` (name = `{involvedObject.kind}.{timestamp}.{hash}`)

## Interface du store (EtcdStore)

### Méthodes de base

```typescript
interface EtcdStore {
  // Get single resource by key
  get(key: string): Result<KubernetesResource>
  
  // Put resource (create or update)
  put(key: string, resource: KubernetesResource): void
  
  // List all resources with prefix
  list(prefix: string): KubernetesResource[]
  
  // Delete resource by key
  delete(key: string): Result<KubernetesResource>
  
  // Watch for changes (futur)
  watch(prefix: string, callback: (event: WatchEvent) => void): UnsubscribeFn
  
  // Get all keys with prefix (utile pour debug)
  listKeys(prefix: string): string[]
}
```

### Implémentation interne

- **Stockage** : `Map<string, KubernetesResource>` (clé → ressource)
- **Index** : Optionnel, pour performance (namespace index, kind index)
- **Immutabilité** : Créer nouvelle Map à chaque modification (comme actuellement)

## Transformation clé ↔ ressource

### Helpers de conversion

```typescript
// Resource → Key
function resourceToKey(resource: KubernetesResource): string {
  const kind = resource.kind.toLowerCase() + 's' // Pod → pods
  const namespace = resource.metadata.namespace
  const name = resource.metadata.name
  return `/registry/${kind}/${namespace}/${name}`
}

// Key → Resource info
function keyToResourceInfo(key: string): {kind: string, namespace: string, name: string} {
  const parts = key.split('/')
  // /registry/pods/default/nginx
  return {
    kind: parts[2],      // pods
    namespace: parts[3], // default
    name: parts[4]       // nginx
  }
}
```

## API de requête (QueryAPI)

### Interface

```typescript
interface QueryOptions {
  kind?: string              // 'pods', 'configmaps', etc.
  namespace?: string         // 'default', ou undefined pour tous
  name?: string              // Nom spécifique
  labelSelector?: Record<string, string>  // {app: 'nginx', env: 'prod'}
  fieldSelector?: Record<string, string>  // {status.phase: 'Running'}
}

interface QueryAPI {
  // Get single resource
  getResource(kind: string, name: string, namespace: string): Result<KubernetesResource>
  
  // List resources with options
  listResources(options: QueryOptions): KubernetesResource[]
  
  // Generic query (flexible)
  query(options: QueryOptions): KubernetesResource[]
}
```

### Implémentation

La QueryAPI utilise le EtcdStore en interne :

```typescript
function listResources(options: QueryOptions): KubernetesResource[] {
  // 1. Construire le préfixe de clé
  const prefix = options.kind 
    ? `/registry/${options.kind}/${options.namespace || ''}`
    : `/registry/`
  
  // 2. Lister depuis le store
  let resources = store.list(prefix)
  
  // 3. Filtrer par namespace si spécifié
  if (options.namespace) {
    resources = resources.filter(r => r.metadata.namespace === options.namespace)
  }
  
  // 4. Filtrer par name si spécifié
  if (options.name) {
    resources = resources.filter(r => r.metadata.name === options.name)
  }
  
  // 5. Filtrer par labels
  if (options.labelSelector) {
    resources = filterByLabels(resources, options.labelSelector)
  }
  
  // 6. Filtrer par fields
  if (options.fieldSelector) {
    resources = filterByFields(resources, options.fieldSelector)
  }
  
  return resources
}
```

## Migration depuis l'architecture actuelle

### Étape 1 : Créer EtcdStore

**Fichier** : `src/core/cluster/store/EtcdStore.ts`

- Implémenter l'interface EtcdStore
- Utiliser Map<string, KubernetesResource> en interne
- Méthodes get, put, list, delete

### Étape 2 : Créer QueryAPI

**Fichier** : `src/core/cluster/store/QueryAPI.ts`

- Implémenter l'interface QueryAPI
- Utiliser EtcdStore en interne
- Helpers de transformation clé ↔ ressource

### Étape 3 : Adapter ClusterState

**Fichier** : `src/core/cluster/ClusterState.ts`

- Remplacer `ClusterStateData` par `EtcdStore`
- Garder l'interface `ClusterState` pour compatibilité
- Implémenter les méthodes via QueryAPI

```typescript
// Avant
getPods(namespace?: string): Pod[] {
  return podOps.getAll(getState(), namespace)
}

// Après
getPods(namespace?: string): Pod[] {
  return queryAPI.listResources({kind: 'pods', namespace}) as Pod[]
}
```

### Étape 4 : Migrer les handlers

**Fichiers** : `src/core/cluster/events/handlers.ts`

- Adapter les handlers pour utiliser EtcdStore
- Transformer les ressources en clés avant stockage

### Étape 5 : Adapter kubectl

**Fichier** : `src/core/kubectl/commands/handlers/get.ts`

- Utiliser QueryAPI au lieu de handlers spécifiques
- Support natif des sélecteurs (labelSelector, fieldSelector)

## Impact sur les consommateurs

### kubectl

**Avant** :
```typescript
const items = handler.getItems(state)  // Spécifique par ressource
```

**Après** :
```typescript
const items = queryAPI.listResources({
  kind: parsed.resource,
  namespace: parsed.namespace,
  labelSelector: parsed.selector
})
```

### etcdctl (futur)

**Nouveau** :
```typescript
// etcdctl get /registry/pods/default/nginx
etcdStore.get('/registry/pods/default/nginx')

// etcdctl get /registry/pods/default --prefix
etcdStore.list('/registry/pods/default/')
```

### API directe (futur)

**Nouveau** :
```typescript
// Requête flexible
const pods = queryAPI.query({
  kind: 'pods',
  namespace: 'default',
  labelSelector: {app: 'nginx'},
  fieldSelector: {status.phase: 'Running'}
})
```

## Persistence

### Format de stockage

**Avant** :
```json
{
  "pods": {"items": [...]},
  "configMaps": {"items": [...]},
  "secrets": {"items": [...]}
}
```

**Après** :
```json
{
  "store": {
    "/registry/pods/default/nginx": {...},
    "/registry/pods/default/redis": {...},
    "/registry/configmaps/default/app-config": {...}
  }
}
```

**Migration** : Script de migration pour convertir l'ancien format au nouveau.

## Plan d'implémentation

### Phase 1 : Fondations (MVP)

1. **Créer EtcdStore**
   - Interface de base (get, put, list, delete)
   - Stockage Map<string, Resource>
   - Tests unitaires

2. **Créer QueryAPI**
   - Interface de requête
   - Transformation clé ↔ ressource
   - Filtrage basique (namespace, name)
   - Tests unitaires

3. **Adapter ClusterState**
   - Remplacer ClusterStateData par EtcdStore
   - Implémenter méthodes via QueryAPI
   - Garder compatibilité avec interface existante
   - Tests d'intégration

### Phase 2 : Migration complète

4. **Migrer les handlers d'événements**
   - Adapter pour utiliser EtcdStore
   - Transformer ressources en clés
   - Tests

5. **Adapter kubectl handlers**
   - Utiliser QueryAPI dans get.ts
   - Support labelSelector
   - Tests

6. **Migration de la persistence**
   - Nouveau format de stockage
   - Script de migration
   - Tests de migration

### Phase 3 : Features avancées (futur)

7. **Support fieldSelector**
   - Filtrage par champs (status.phase, etc.)
   - Tests

8. **Watch API**
   - Implémenter watch() dans EtcdStore
   - Notifications de changements
   - Tests

9. **Index pour performance**
   - Index par namespace
   - Index par kind
   - Tests de performance

## Fichiers à créer/modifier

### Nouveaux fichiers

- `src/core/cluster/store/EtcdStore.ts` - Store clé-valeur
- `src/core/cluster/store/QueryAPI.ts` - API de requête
- `src/core/cluster/store/keyHelpers.ts` - Helpers clé ↔ ressource
- `src/core/cluster/store/types.ts` - Types partagés
- `tests/unit/cluster/store/EtcdStore.test.ts` - Tests store
- `tests/unit/cluster/store/QueryAPI.test.ts` - Tests query API

### Fichiers à modifier

- `src/core/cluster/ClusterState.ts` - Utiliser EtcdStore + QueryAPI
- `src/core/cluster/events/handlers.ts` - Adapter pour EtcdStore
- `src/core/kubectl/commands/handlers/get.ts` - Utiliser QueryAPI
- `src/core/cluster/storage/` - Nouveau format de persistence
- `src/core/cluster/repositories/` - Peut être supprimé (remplacé par EtcdStore)

## Avantages de cette architecture

1. **Authenticité** : Proche d'etcd (source de vérité de K8s)
2. **Flexibilité** : API générique, facile d'ajouter des ressources
3. **Extensibilité** : Support futur pour etcdctl, API directe
4. **Performance** : Map native, index optionnels
5. **Simplicité** : Interface claire, séparation des responsabilités

## Inconvénients / Risques

1. **Complexité initiale** : Migration nécessaire
2. **Breaking changes** : Interface ClusterState peut changer
3. **Tests** : Beaucoup de tests à migrer
4. **Performance** : À vérifier avec centaines de ressources

## Questions ouvertes

1. **Index** : Nécessaire dès le début ou plus tard ?
2. **Watch** : Implémenter maintenant ou plus tard ?
3. **Migration** : Automatique ou manuelle ?
4. **Compatibilité** : Garder l'ancienne interface ClusterState ou breaking change ?

## Références

- [etcd documentation](https://etcd.io/docs/)
- [Kubernetes etcd keys](https://github.com/kubernetes/community/blob/master/contributors/design-proposals/api-machinery/etcd-keys.md)
- Architecture actuelle : `src/core/cluster/ClusterState.ts`

