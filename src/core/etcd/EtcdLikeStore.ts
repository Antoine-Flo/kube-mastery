import type {
  ClusterState,
  ClusterStateData,
  KindToResource,
  ResourceKind,
  CreateClusterStateOptions
} from '../cluster/ClusterState'
import { createClusterState } from '../cluster/ClusterState'
import type { EventBus } from '../cluster/events/EventBus'
import type { AppEvent } from '../events/AppEvent'

const CLUSTER_MUTATION_EVENT_TYPES = new Set<string>([
  'PodCreated',
  'PodUpdated',
  'PodDeleted',
  'PodBound',
  'ConfigMapCreated',
  'ConfigMapUpdated',
  'ConfigMapDeleted',
  'SecretCreated',
  'SecretUpdated',
  'SecretDeleted',
  'ReplicaSetCreated',
  'ReplicaSetUpdated',
  'ReplicaSetDeleted',
  'DeploymentCreated',
  'DeploymentUpdated',
  'DeploymentDeleted',
  'DaemonSetCreated',
  'DaemonSetUpdated',
  'DaemonSetDeleted',
  'ServiceCreated',
  'ServiceUpdated',
  'ServiceDeleted',
  'PersistentVolumeCreated',
  'PersistentVolumeUpdated',
  'PersistentVolumeDeleted',
  'PersistentVolumeClaimCreated',
  'PersistentVolumeClaimUpdated',
  'PersistentVolumeClaimDeleted',
  'PodLabeled',
  'PodAnnotated',
  'ConfigMapLabeled',
  'ConfigMapAnnotated',
  'SecretLabeled',
  'SecretAnnotated',
  'ServiceLabeled',
  'ServiceAnnotated',
  'NodeCreated',
  'NodeUpdated',
  'NodeDeleted',
  'NamespaceCreated',
  'NamespaceUpdated',
  'NamespaceDeleted',
  'IngressCreated',
  'IngressUpdated',
  'IngressDeleted'
])

const isClusterMutationEvent = (event: AppEvent): boolean => {
  return CLUSTER_MUTATION_EVENT_TYPES.has(event.type)
}

export interface EtcdLikeStore {
  readonly clusterState: ClusterState
  findResource: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ) => ReturnType<ClusterState['findByKind']>
  listResources: <TKind extends ResourceKind>(
    kind: TKind,
    namespace?: string
  ) => KindToResource<TKind>[]
  appendEvent: (event: AppEvent) => number
  getEventLog: () => ReadonlyArray<EtcdEventRecord>
  getRevision: () => number
  getResourceVersion: () => string
  snapshot: () => ClusterStateData
  snapshotWithRevision: () => {
    revision: number
    state: ClusterStateData
  }
  restore: (state: ClusterStateData) => void
  dispose: () => void
}

export interface EtcdEventRecord {
  revision: number
  resourceVersion: string
  eventType: AppEvent['type']
  timestamp?: string
  source?: string
  event: AppEvent
}

const buildEventRecord = (revision: number, event: AppEvent): EtcdEventRecord => {
  const withTimestamp = event as { timestamp?: string }
  const withMetadata = event as { metadata?: { source?: string } }
  return {
    revision,
    resourceVersion: String(revision),
    eventType: event.type,
    timestamp: withTimestamp.timestamp,
    source: withMetadata.metadata?.source,
    event
  }
}

export const createEtcdLikeStore = (
  eventBus: EventBus,
  options?: CreateClusterStateOptions
): EtcdLikeStore => {
  const clusterState = createClusterState(eventBus, options)
  let revision = 1
  let eventLog: EtcdEventRecord[] = []
  const unsubscribe = eventBus.subscribeAll((event) => {
    if (!isClusterMutationEvent(event)) {
      eventLog = [...eventLog, buildEventRecord(revision, event)]
      return
    }
    revision = revision + 1
    eventLog = [...eventLog, buildEventRecord(revision, event)]
  })

  return {
    clusterState,
    findResource: (kind, name, namespace) => {
      return clusterState.findByKind(kind, name, namespace)
    },
    listResources: (kind, namespace) => {
      return clusterState.listByKind(kind, namespace)
    },
    appendEvent: (event: AppEvent) => {
      eventBus.emit(event)
      return revision
    },
    getEventLog: () => {
      return [...eventLog]
    },
    getRevision: () => revision,
    getResourceVersion: () => String(revision),
    snapshot: () => clusterState.toJSON(),
    snapshotWithRevision: () => {
      return {
        revision,
        state: clusterState.toJSON()
      }
    },
    restore: (state: ClusterStateData) => {
      clusterState.loadState(state)
      revision = revision + 1
    },
    dispose: () => {
      unsubscribe()
    }
  }
}
