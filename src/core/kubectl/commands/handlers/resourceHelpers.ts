// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE HELPERS
// ═══════════════════════════════════════════════════════════════════════════
// Generic functions for apply/create operations to avoid code duplication
// Now supports event-driven architecture with EventBus

import type { ClusterState } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import {
  createConfigMapCreatedEvent,
  createConfigMapUpdatedEvent,
  createDaemonSetCreatedEvent,
  createDaemonSetUpdatedEvent,
  createDeploymentCreatedEvent,
  createDeploymentUpdatedEvent,
  createPodCreatedEvent,
  createPodUpdatedEvent,
  createReplicaSetCreatedEvent,
  createReplicaSetUpdatedEvent,
  createSecretCreatedEvent,
  createSecretUpdatedEvent,
  createServiceCreatedEvent,
  createServiceUpdatedEvent
} from '../../../cluster/events/types'
import type { ConfigMap } from '../../../cluster/ressources/ConfigMap'
import type { DaemonSet } from '../../../cluster/ressources/DaemonSet'
import type { Deployment } from '../../../cluster/ressources/Deployment'
import type { Node } from '../../../cluster/ressources/Node'
import type { Pod } from '../../../cluster/ressources/Pod'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import type { Secret } from '../../../cluster/ressources/Secret'
import type { Service } from '../../../cluster/ressources/Service'
import type { ExecutionResult, Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'

// ─── Event-Driven Resource Operations ───────────────────────────────────

type KubernetesResource =
  | Pod
  | ConfigMap
  | Secret
  | Node
  | ReplicaSet
  | Deployment
  | DaemonSet
  | Service

type ResourceKind =
  | 'Pod'
  | 'ConfigMap'
  | 'Secret'
  | 'Node'
  | 'ReplicaSet'
  | 'Deployment'
  | 'DaemonSet'
  | 'Service'

interface ResourceHandler {
  find: (state: ClusterState, name: string, namespace: string) => Result<any>
  emitCreated: (eventBus: EventBus, resource: KubernetesResource) => void
  emitUpdated: (
    eventBus: EventBus,
    name: string,
    namespace: string,
    resource: KubernetesResource,
    previous: any
  ) => void
  updateDirect?: (
    state: ClusterState,
    name: string,
    resource: KubernetesResource
  ) => void
  addDirect?: (state: ClusterState, resource: KubernetesResource) => void
}

const KIND_REFERENCE_BY_KIND: Partial<Record<ResourceKind, string>> = {
  Deployment: 'deployment.apps',
  DaemonSet: 'daemonset.apps',
  ReplicaSet: 'replicaset.apps'
}

const toKindReference = (kind: ResourceKind): string => {
  return KIND_REFERENCE_BY_KIND[kind] ?? kind.toLowerCase()
}

const toPluralKindReference = (kind: ResourceKind): string => {
  if (kind === 'Deployment') {
    return 'deployments.apps'
  }
  if (kind === 'ReplicaSet') {
    return 'replicasets.apps'
  }
  if (kind === 'DaemonSet') {
    return 'daemonsets.apps'
  }
  return `${kind.toLowerCase()}s`
}

// ─── Resource Handlers Configuration ─────────────────────────────────────

const resourceHandlers: Record<ResourceKind, ResourceHandler> = {
  Pod: {
    find: (state, name, namespace) => state.findByKind('Pod', name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createPodCreatedEvent(resource as Pod, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(
        createPodUpdatedEvent(
          name,
          namespace,
          resource as Pod,
          previous,
          'kubectl'
        )
      )
    }
  },
  ConfigMap: {
    find: (state, name, namespace) =>
      state.findByKind('ConfigMap', name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(
        createConfigMapCreatedEvent(resource as ConfigMap, 'kubectl')
      )
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(
        createConfigMapUpdatedEvent(
          name,
          namespace,
          resource as ConfigMap,
          previous,
          'kubectl'
        )
      )
    }
  },
  Secret: {
    find: (state, name, namespace) => state.findByKind('Secret', name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createSecretCreatedEvent(resource as Secret, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(
        createSecretUpdatedEvent(
          name,
          namespace,
          resource as Secret,
          previous,
          'kubectl'
        )
      )
    }
  },
  Node: {
    find: (state, name, _namespace) => state.findByKind('Node', name), // Nodes are cluster-scoped, ignore namespace
    emitCreated: (_eventBus, _resource) => {
      // Nodes use direct state update for now (placeholder events not yet implemented)
    },
    emitUpdated: (_eventBus, _name, _namespace, _resource, _previous) => {
      // Nodes use direct state update for now (placeholder events not yet implemented)
    },
    updateDirect: (state, name, resource: KubernetesResource) => {
      state.updateNode(name, () => resource as Node)
    },
    addDirect: (state, resource: KubernetesResource) => {
      state.addNode(resource as Node)
    }
  },
  ReplicaSet: {
    find: (state, name, namespace) =>
      state.findByKind('ReplicaSet', name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(
        createReplicaSetCreatedEvent(resource as ReplicaSet, 'kubectl')
      )
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(
        createReplicaSetUpdatedEvent(
          name,
          namespace,
          resource as ReplicaSet,
          previous,
          'kubectl'
        )
      )
    }
  },
  Deployment: {
    find: (state, name, namespace) =>
      state.findByKind('Deployment', name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(
        createDeploymentCreatedEvent(resource as Deployment, 'kubectl')
      )
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(
        createDeploymentUpdatedEvent(
          name,
          namespace,
          resource as Deployment,
          previous,
          'kubectl'
        )
      )
    }
  },
  DaemonSet: {
    find: (state, name, namespace) =>
      state.findByKind('DaemonSet', name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(
        createDaemonSetCreatedEvent(resource as DaemonSet, 'kubectl')
      )
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(
        createDaemonSetUpdatedEvent(
          name,
          namespace,
          resource as DaemonSet,
          previous,
          'kubectl'
        )
      )
    }
  },
  Service: {
    find: (state, name, namespace) => state.findByKind('Service', name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createServiceCreatedEvent(resource as Service, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(
        createServiceUpdatedEvent(
          name,
          namespace,
          resource as Service,
          previous,
          'kubectl'
        )
      )
    }
  }
}

/**
 * Apply resource using event-driven architecture
 * Emits PodCreated/Updated, ConfigMapCreated/Updated, or SecretCreated/Updated events
 */
export const applyResourceWithEvents = (
  resource: KubernetesResource,
  clusterState: ClusterState,
  eventBus: EventBus
): ExecutionResult => {
  const { name, namespace } = resource.metadata
  const kind = resource.kind as ResourceKind

  const handler = resourceHandlers[kind]
  if (!handler) {
    return error(
      `error: the server doesn't have a resource type "${kind.toLowerCase()}s"`
    )
  }

  // Check if resource exists (Nodes ignore namespace)
  const existing = handler.find(clusterState, name, namespace)

  if (existing.ok) {
    // Update: emit updated event or update directly
    if (handler.updateDirect) {
      handler.updateDirect(clusterState, name, resource)
    } else {
      handler.emitUpdated(eventBus, name, namespace, resource, existing.value)
    }
    return success(`${toKindReference(kind)}/${name} configured`)
  } else {
    // Create: emit created event or add directly
    if (handler.addDirect) {
      handler.addDirect(clusterState, resource)
    } else {
      handler.emitCreated(eventBus, resource)
    }
    return success(`${toKindReference(kind)}/${name} created`)
  }
}

/**
 * Create resource using event-driven architecture
 * Emits PodCreated, ConfigMapCreated, or SecretCreated events
 * Fails if resource already exists
 */
export const createResourceWithEvents = (
  resource: KubernetesResource,
  clusterState: ClusterState,
  eventBus: EventBus
): ExecutionResult => {
  const { name, namespace } = resource.metadata
  const kind = resource.kind as ResourceKind

  const handler = resourceHandlers[kind]
  if (!handler) {
    return error(
      `error: the server doesn't have a resource type "${kind.toLowerCase()}s"`
    )
  }

  // Check if resource exists (Nodes ignore namespace)
  const existing = handler.find(clusterState, name, namespace)

  if (existing.ok) {
    return error(
      `Error from server (AlreadyExists): ${toPluralKindReference(kind)} "${name}" already exists`
    )
  }

  // Emit created event or add directly
  if (handler.addDirect) {
    handler.addDirect(clusterState, resource)
  } else {
    handler.emitCreated(eventBus, resource)
  }

  return success(`${toKindReference(kind)}/${name} created`)
}
