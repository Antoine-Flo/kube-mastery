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
import type { Deployment } from '../../../cluster/ressources/Deployment'
import type { Node } from '../../../cluster/ressources/Node'
import type { Pod } from '../../../cluster/ressources/Pod'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import type { Secret } from '../../../cluster/ressources/Secret'
import type { Service } from '../../../cluster/ressources/Service'
import type { ExecutionResult, Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'

// ─── Event-Driven Resource Operations ───────────────────────────────────

type KubernetesResource = Pod | ConfigMap | Secret | Node | ReplicaSet | Deployment | Service

type ResourceKind = 'Pod' | 'ConfigMap' | 'Secret' | 'Node' | 'ReplicaSet' | 'Deployment' | 'Service'

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
  updateDirect?: (state: ClusterState, name: string, resource: KubernetesResource) => void
  addDirect?: (state: ClusterState, resource: KubernetesResource) => void
}

// ─── Resource Handlers Configuration ─────────────────────────────────────

const resourceHandlers: Record<ResourceKind, ResourceHandler> = {
  Pod: {
    find: (state, name, namespace) => state.findPod(name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createPodCreatedEvent(resource as Pod, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(createPodUpdatedEvent(name, namespace, resource as Pod, previous, 'kubectl'))
    }
  },
  ConfigMap: {
    find: (state, name, namespace) => state.findConfigMap(name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createConfigMapCreatedEvent(resource as ConfigMap, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(createConfigMapUpdatedEvent(name, namespace, resource as ConfigMap, previous, 'kubectl'))
    }
  },
  Secret: {
    find: (state, name, namespace) => state.findSecret(name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createSecretCreatedEvent(resource as Secret, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(createSecretUpdatedEvent(name, namespace, resource as Secret, previous, 'kubectl'))
    }
  },
  Node: {
    find: (state, name, _namespace) => state.findNode(name), // Nodes are cluster-scoped, ignore namespace
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
    find: (state, name, namespace) => state.findReplicaSet(name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createReplicaSetCreatedEvent(resource as ReplicaSet, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(createReplicaSetUpdatedEvent(name, namespace, resource as ReplicaSet, previous, 'kubectl'))
    }
  },
  Deployment: {
    find: (state, name, namespace) => state.findDeployment(name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createDeploymentCreatedEvent(resource as Deployment, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(createDeploymentUpdatedEvent(name, namespace, resource as Deployment, previous, 'kubectl'))
    }
  },
  Service: {
    find: (state, name, namespace) => state.findService(name, namespace),
    emitCreated: (eventBus, resource) => {
      eventBus.emit(createServiceCreatedEvent(resource as Service, 'kubectl'))
    },
    emitUpdated: (eventBus, name, namespace, resource, previous) => {
      eventBus.emit(createServiceUpdatedEvent(name, namespace, resource as Service, previous, 'kubectl'))
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
    return error(`error: the server doesn't have a resource type "${kind.toLowerCase()}s"`)
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
    return success(`${kind.toLowerCase()}/${name} configured`)
  } else {
    // Create: emit created event or add directly
    if (handler.addDirect) {
      handler.addDirect(clusterState, resource)
    } else {
      handler.emitCreated(eventBus, resource)
    }
    return success(`${kind.toLowerCase()}/${name} created`)
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
    return error(`error: the server doesn't have a resource type "${kind.toLowerCase()}s"`)
  }

  // Check if resource exists (Nodes ignore namespace)
  const existing = handler.find(clusterState, name, namespace)

  if (existing.ok) {
    return error(`Error from server (AlreadyExists): ${kind.toLowerCase()}s "${name}" already exists`)
  }

  // Emit created event or add directly
  if (handler.addDirect) {
    handler.addDirect(clusterState, resource)
  } else {
    handler.emitCreated(eventBus, resource)
  }

  return success(`${kind.toLowerCase()}/${name} created`)
}
