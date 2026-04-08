import type { ClusterStateData, ResourceKind } from '../ClusterState'
import { addPod, deletePod, updatePod } from '../ClusterState'
import {
  CLUSTER_SCOPED_RESOURCE_KINDS,
  COLLECTION_KEY_BY_RESOURCE_KIND,
  repos
} from '../generated/clusterRegistry.generated'
import type { ResourceCollection } from '../repositories/types'
import type { Pod } from '../ressources/Pod'
import type { ClusterEvent } from './types'
import { releasePersistentVolumeBacking } from '../../volumes/runtime'

// ═══════════════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
// Pure functions that apply events to cluster state.
// Each handler takes current state + event and returns new state.

// ─── Generic Handler Factories ───────────────────────────────────────────

/**
 * Factory: Create handler for repository-based resources (ConfigMap, Secret)
 */
type RepoStateKey = Exclude<keyof typeof repos, 'pods'>
type RepoResourceByStateKey<TKey extends RepoStateKey> =
  ClusterStateData[TKey] extends ResourceCollection<infer TResource>
    ? TResource
    : never

type RepoCollectionByStateKey = {
  [TKey in RepoStateKey]: ResourceCollection<RepoResourceByStateKey<TKey>>
}

type RepoAdapter<TKey extends RepoStateKey> = {
  add: (
    collection: RepoCollectionByStateKey[TKey],
    resource: RepoResourceByStateKey<TKey>
  ) => RepoCollectionByStateKey[TKey]
  remove: (
    collection: RepoCollectionByStateKey[TKey],
    name: string,
    namespace: string
  ) => {
    ok: boolean
    collection?: RepoCollectionByStateKey[TKey]
  }
  update: (
    collection: RepoCollectionByStateKey[TKey],
    name: string,
    namespace: string,
    updateFn: (resource: RepoResourceByStateKey<TKey>) => RepoResourceByStateKey<TKey>
  ) => {
    ok: boolean
    collection?: RepoCollectionByStateKey[TKey]
  }
}

const createRepoHandler = <TKey extends RepoStateKey>(
  stateKey: TKey
) => ({
  created: (
    state: ClusterStateData,
    resource: RepoResourceByStateKey<TKey>
  ) => {
    const repo = repos[stateKey] as unknown as RepoAdapter<TKey>
    const collection = repo.add(
      state[stateKey] as RepoCollectionByStateKey[TKey],
      resource
    )
    return { ...state, [stateKey]: collection }
  },

  deleted: (state: ClusterStateData, name: string, namespace: string) => {
    const repo = repos[stateKey] as unknown as RepoAdapter<TKey>
    const result = repo.remove(
      state[stateKey] as RepoCollectionByStateKey[TKey],
      name,
      namespace
    )
    return result.ok && result.collection
      ? { ...state, [stateKey]: result.collection }
      : state
  },

  updated: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    resource: RepoResourceByStateKey<TKey>
  ) => {
    const repo = repos[stateKey] as unknown as RepoAdapter<TKey>
    const result = repo.update(
      state[stateKey] as RepoCollectionByStateKey[TKey],
      name,
      namespace,
      () => resource
    )
    return result.ok && result.collection
      ? { ...state, [stateKey]: result.collection }
      : state
  }
})

/**
 * Factory: Create handler for Pod operations
 */
const createPodHandler = () => ({
  created: (state: ClusterStateData, pod: Pod) => addPod(state, pod),

  deleted: (state: ClusterStateData, name: string, namespace: string) => {
    const result = deletePod(state, name, namespace)
    return result.ok && result.state ? result.state : state
  },

  updated: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    pod: Pod
  ) => {
    const result = updatePod(state, name, namespace, () => pod)
    return result.ok && result.state ? result.state : state
  }
})

// ─── Handler Instances ───────────────────────────────────────────────────

const podHandler = createPodHandler()
const repoHandlers = Object.fromEntries(
  (Object.keys(repos) as (keyof typeof repos)[])
    .filter((key) => {
      return key !== 'pods'
    })
    .map((key) => {
      return [key, createRepoHandler(key as RepoStateKey)]
    })
) as Record<RepoStateKey, ReturnType<typeof createRepoHandler<RepoStateKey>>>

// ─── Pod Handlers ────────────────────────────────────────────────────────

export const handlePodCreated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'PodCreated' }>
) => {
  return podHandler.created(state, event.payload.pod)
}

export const handlePodDeleted = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'PodDeleted' }>
) => podHandler.deleted(state, event.payload.name, event.payload.namespace)

export const handlePodUpdated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'PodUpdated' }>
) =>
  podHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.pod
  )

export const handlePodLabeled = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'PodLabeled' }>
) =>
  podHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.pod
  )

export const handlePodAnnotated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'PodAnnotated' }>
) =>
  podHandler.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.pod
  )

export const handleConfigMapLabeled = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'ConfigMapLabeled' }>
) =>
  repoHandlers.configMaps.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.configMap
  )

export const handleConfigMapAnnotated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'ConfigMapAnnotated' }>
) =>
  repoHandlers.configMaps.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.configMap
  )

export const handleSecretLabeled = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'SecretLabeled' }>
) =>
  repoHandlers.secrets.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.secret
  )

export const handleSecretAnnotated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'SecretAnnotated' }>
) =>
  repoHandlers.secrets.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.secret
  )

export const handleServiceLabeled = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'ServiceLabeled' }>
) =>
  repoHandlers.services.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.service
  )

export const handleServiceAnnotated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'ServiceAnnotated' }>
) =>
  repoHandlers.services.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.service
  )

export const handleEventCreated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'EventCreated' }>
) => repoHandlers.events.created(state, event.payload.event)

export const handleEventDeleted = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'EventDeleted' }>
) => repoHandlers.events.deleted(state, event.payload.name, event.payload.namespace)

export const handleEventUpdated = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'EventUpdated' }>
) =>
  repoHandlers.events.updated(
    state,
    event.payload.name,
    event.payload.namespace,
    event.payload.event
  )

export const handlePersistentVolumeDeleted = (
  state: ClusterStateData,
  event: Extract<ClusterEvent, { type: 'PersistentVolumeDeleted' }>
) => {
  releasePersistentVolumeBacking(event.payload.name)
  return repoHandlers.persistentVolumes.deleted(state, event.payload.name, '')
}

export type ClusterEventType = ClusterEvent['type']
type ClusterEventByType = {
  [TType in ClusterEventType]: Extract<ClusterEvent, { type: TType }>
}
type ClusterEventHandler<TType extends ClusterEventType> = (
  state: ClusterStateData,
  event: ClusterEventByType[TType]
) => ClusterStateData

type ClusterEventDefinition<TType extends ClusterEventType> = {
  handler: ClusterEventHandler<TType>
  mutatesState: boolean
}

const defineClusterEvent = <TType extends ClusterEventType>(
  handler: ClusterEventHandler<TType>,
  mutatesState = true
): ClusterEventDefinition<TType> => {
  return { handler, mutatesState }
}

const toPayloadKeyFromKind = (kind: string): string => {
  if (kind === 'HTTPRoute') {
    return 'httpRoute'
  }
  return `${kind.slice(0, 1).toLowerCase()}${kind.slice(1)}`
}

const GENERATED_REPO_EVENT_DEFINITIONS: {
  [TType in ClusterEventType]?: ClusterEventDefinition<TType>
} = Object.fromEntries(
  (Object.keys(COLLECTION_KEY_BY_RESOURCE_KIND) as ResourceKind[]).flatMap(
    (kind) => {
      if (kind === 'Pod') {
        return []
      }
      const stateKey = COLLECTION_KEY_BY_RESOURCE_KIND[kind] as RepoStateKey
      const payloadKey = toPayloadKeyFromKind(kind)
      const isClusterScoped =
        (CLUSTER_SCOPED_RESOURCE_KINDS as readonly ResourceKind[]).includes(
          kind
        ) ||
        kind === 'Node' ||
        kind === 'Namespace'
      const createdType = `${kind}Created`
      const deletedType = `${kind}Deleted`
      const updatedType = `${kind}Updated`
      return [
        [
          createdType,
          defineClusterEvent(
            ((state, event) => {
              return repoHandlers[stateKey].created(
                state,
                (event as any).payload[payloadKey]
              )
            }) as ClusterEventHandler<ClusterEventType>
          )
        ],
        [
          deletedType,
          defineClusterEvent(
            ((state, event) => {
              const namespace = isClusterScoped
                ? ''
                : ((event as any).payload.namespace as string)
              return repoHandlers[stateKey].deleted(
                state,
                (event as any).payload.name,
                namespace
              )
            }) as ClusterEventHandler<ClusterEventType>
          )
        ],
        [
          updatedType,
          defineClusterEvent(
            ((state, event) => {
              const namespace = isClusterScoped
                ? ''
                : ((event as any).payload.namespace as string)
              return repoHandlers[stateKey].updated(
                state,
                (event as any).payload.name,
                namespace,
                (event as any).payload[payloadKey]
              )
            }) as ClusterEventHandler<ClusterEventType>
          )
        ]
      ]
    }
  )
) as {
  [TType in ClusterEventType]?: ClusterEventDefinition<TType>
}

/**
 * Event definitions are the single source of truth for:
 * - state transition handlers
 * - etcd revision mutation tracking
 */
export const CLUSTER_EVENT_DEFINITIONS: {
  [TType in ClusterEventType]?: ClusterEventDefinition<TType>
} = {
  ...GENERATED_REPO_EVENT_DEFINITIONS,
  PodCreated: defineClusterEvent(handlePodCreated),
  PodDeleted: defineClusterEvent(handlePodDeleted),
  PodUpdated: defineClusterEvent(handlePodUpdated),
  PodLabeled: defineClusterEvent(handlePodLabeled),
  ConfigMapLabeled: defineClusterEvent(handleConfigMapLabeled),
  SecretLabeled: defineClusterEvent(handleSecretLabeled),
  PodAnnotated: defineClusterEvent(handlePodAnnotated),
  ConfigMapAnnotated: defineClusterEvent(handleConfigMapAnnotated),
  SecretAnnotated: defineClusterEvent(handleSecretAnnotated),
  ServiceLabeled: defineClusterEvent(handleServiceLabeled),
  ServiceAnnotated: defineClusterEvent(handleServiceAnnotated),
  PersistentVolumeDeleted: defineClusterEvent(handlePersistentVolumeDeleted),
  // Keep these overrides explicit due to non-default semantics.
  EventCreated: defineClusterEvent(handleEventCreated, false),
  EventDeleted: defineClusterEvent(handleEventDeleted, false),
  EventUpdated: defineClusterEvent(handleEventUpdated, false)
}

/**
 * Event handler map for state application.
 * Derived from CLUSTER_EVENT_DEFINITIONS to avoid dual maintenance.
 */
export const CLUSTER_EVENT_HANDLERS: {
  [TType in ClusterEventType]?: ClusterEventHandler<TType>
} = Object.fromEntries(
  Object.entries(CLUSTER_EVENT_DEFINITIONS).flatMap(
    ([eventType, definition]) => {
      if (!definition) {
        return []
      }
      return [[eventType, definition.handler]]
    }
  )
) as {
  [TType in ClusterEventType]?: ClusterEventHandler<TType>
}

/**
 * Cluster mutation event types used by EtcdLikeStore revision tracking.
 * Derived from CLUSTER_EVENT_DEFINITIONS to keep one source of truth.
 */
export const CLUSTER_MUTATION_EVENT_TYPES = new Set<string>(
  Object.entries(CLUSTER_EVENT_DEFINITIONS).flatMap(
    ([eventType, definition]) => {
      if (!definition || !definition.mutatesState) {
        return []
      }
      return [eventType]
    }
  )
)

/**
 * Apply event to cluster state
 * Dispatches to appropriate handler based on event type
 */
export const applyClusterEventToState = (
  state: ClusterStateData,
  event: ClusterEvent
): ClusterStateData => {
  const handler = CLUSTER_EVENT_HANDLERS[event.type] as
    | ClusterEventHandler<ClusterEventType>
    | undefined
  if (!handler) {
    return state
  }
  return handler(state, event)
}
