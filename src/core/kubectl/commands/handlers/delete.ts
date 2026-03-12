import type { ClusterState, ResourceKind } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import {
  createConfigMapDeletedEvent,
  createPersistentVolumeClaimDeletedEvent,
  createPersistentVolumeDeletedEvent,
  createPodDeletedEvent,
  createSecretDeletedEvent
} from '../../../cluster/events/types'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'

const formatDeletedMessage = (
  kindRef: string,
  name: string,
  namespace: string,
  namespaced: boolean
): string => {
  if (!namespaced) {
    return `${kindRef} "${name}" deleted`
  }
  return `${kindRef} "${name}" deleted from ${namespace} namespace`
}

const formatNotFoundMessage = (
  kindRefPlural: string,
  name: string
): ExecutionResult => {
  return error(
    `Error from server (NotFound): ${kindRefPlural} "${name}" not found`
  )
}

type NamespacedEventDeleteResource = 'pods' | 'configmaps' | 'secrets'

interface NamespacedDeleteConfig {
  kind: ResourceKind
  kindRef: string
  emit: (
    eventBus: EventBus,
    name: string,
    namespace: string,
    resource: unknown
  ) => void
}

const deleteNamespacedResourcesForNamespace = (
  clusterState: ClusterState,
  namespace: string
): ExecutionResult | undefined => {
  const pods = clusterState.getPods(namespace)
  for (const pod of pods) {
    const result = clusterState.deletePod(pod.metadata.name, namespace)
    if (!result.ok) {
      return result
    }
  }

  const configMaps = clusterState.getConfigMaps(namespace)
  for (const configMap of configMaps) {
    const result = clusterState.deleteConfigMap(
      configMap.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const secrets = clusterState.getSecrets(namespace)
  for (const secret of secrets) {
    const result = clusterState.deleteSecret(secret.metadata.name, namespace)
    if (!result.ok) {
      return result
    }
  }

  const deployments = clusterState.getDeployments(namespace)
  for (const deployment of deployments) {
    const result = clusterState.deleteDeployment(
      deployment.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const daemonSets = clusterState.getDaemonSets(namespace)
  for (const daemonSet of daemonSets) {
    const result = clusterState.deleteDaemonSet(
      daemonSet.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const replicaSets = clusterState.getReplicaSets(namespace)
  for (const replicaSet of replicaSets) {
    const result = clusterState.deleteReplicaSet(
      replicaSet.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const services = clusterState.getServices(namespace)
  for (const service of services) {
    const result = clusterState.deleteService(service.metadata.name, namespace)
    if (!result.ok) {
      return result
    }
  }

  const persistentVolumeClaims =
    clusterState.getPersistentVolumeClaims(namespace)
  for (const persistentVolumeClaim of persistentVolumeClaims) {
    const result = clusterState.deletePersistentVolumeClaim(
      persistentVolumeClaim.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  return undefined
}

const NAMESPACED_EVENT_DELETE_CONFIG: Record<
  NamespacedEventDeleteResource,
  NamespacedDeleteConfig
> = {
  pods: {
    kind: 'Pod',
    kindRef: 'pod',
    emit: (eventBus, name, namespace, resource) => {
      eventBus.emit(
        createPodDeletedEvent(name, namespace, resource as any, 'kubectl')
      )
    }
  },
  configmaps: {
    kind: 'ConfigMap',
    kindRef: 'configmap',
    emit: (eventBus, name, namespace, resource) => {
      eventBus.emit(
        createConfigMapDeletedEvent(name, namespace, resource as any, 'kubectl')
      )
    }
  },
  secrets: {
    kind: 'Secret',
    kindRef: 'secret',
    emit: (eventBus, name, namespace, resource) => {
      eventBus.emit(
        createSecretDeletedEvent(name, namespace, resource as any, 'kubectl')
      )
    }
  }
}

/**
 * Handle kubectl delete command
 * Uses event-driven architecture to delete resources
 */
export const handleDelete = (
  clusterState: ClusterState,
  parsed: ParsedCommand,
  eventBus: EventBus
): ExecutionResult => {
  const namespace = parsed.namespace || 'default'
  const names =
    parsed.names != null && parsed.names.length > 0
      ? parsed.names
      : parsed.name != null
        ? [parsed.name]
        : []

  if (names.length === 0) {
    return error(`error: you must specify the name of the resource to delete`)
  }

  const resource = parsed.resource
  if (!resource) {
    return error('error: you must specify a resource type')
  }

  if (
    resource === 'pods' ||
    resource === 'configmaps' ||
    resource === 'secrets'
  ) {
    const deleteConfig = NAMESPACED_EVENT_DELETE_CONFIG[resource]
    const messages: string[] = []
    for (const name of names) {
      const findResult = clusterState.findByKind(deleteConfig.kind, name, namespace)
      if (!findResult.ok) {
        return error(findResult.error)
      }
      deleteConfig.emit(eventBus, name, namespace, findResult.value)
      messages.push(
        formatDeletedMessage(deleteConfig.kindRef, name, namespace, true)
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'deployments') {
    const messages: string[] = []
    for (const name of names) {
      const deleteResult = clusterState.deleteDeployment(name, namespace)
      if (!deleteResult.ok) {
        return formatNotFoundMessage('deployments.apps', name)
      }
      messages.push(
        formatDeletedMessage('deployment.apps', name, namespace, true)
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'daemonsets') {
    const messages: string[] = []
    for (const name of names) {
      const deleteResult = clusterState.deleteDaemonSet(name, namespace)
      if (!deleteResult.ok) {
        return formatNotFoundMessage('daemonsets.apps', name)
      }
      messages.push(formatDeletedMessage('daemonset.apps', name, namespace, true))
    }
    return success(messages.join('\n'))
  }

  if (resource === 'services') {
    const messages: string[] = []
    for (const name of names) {
      const deleteResult = clusterState.deleteService(name, namespace)
      if (!deleteResult.ok) {
        return error(deleteResult.error)
      }
      messages.push(formatDeletedMessage('service', name, namespace, true))
    }
    return success(messages.join('\n'))
  }

  if (resource === 'ingresses') {
    const messages: string[] = []
    for (const name of names) {
      const deleteResult = clusterState.deleteIngress(name, namespace)
      if (!deleteResult.ok) {
        return formatNotFoundMessage('ingresses.networking.k8s.io', name)
      }
      messages.push(
        formatDeletedMessage(
          'ingress.networking.k8s.io',
          name,
          namespace,
          true
        )
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'persistentvolumes') {
    const messages: string[] = []
    for (const name of names) {
      const findResult = clusterState.findPersistentVolume(name)
      if (!findResult.ok) {
        return formatNotFoundMessage('persistentvolumes', name)
      }
      eventBus.emit(
        createPersistentVolumeDeletedEvent(name, findResult.value, 'kubectl')
      )
      messages.push(
        formatDeletedMessage('persistentvolume', name, namespace, false)
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'persistentvolumeclaims') {
    const messages: string[] = []
    for (const name of names) {
      const findResult = clusterState.findPersistentVolumeClaim(name, namespace)
      if (!findResult.ok) {
        return formatNotFoundMessage('persistentvolumeclaims', name)
      }
      eventBus.emit(
        createPersistentVolumeClaimDeletedEvent(
          name,
          namespace,
          findResult.value,
          'kubectl'
        )
      )
      messages.push(
        formatDeletedMessage('persistentvolumeclaim', name, namespace, true)
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'namespaces') {
    const messages: string[] = []
    for (const name of names) {
      const existingNamespace = clusterState.findNamespace(name)
      if (!existingNamespace.ok) {
        return formatNotFoundMessage('namespaces', name)
      }
      const cascadeResult = deleteNamespacedResourcesForNamespace(clusterState, name)
      if (cascadeResult != null) {
        return cascadeResult
      }
      const deleteResult = clusterState.deleteNamespace(name)
      if (!deleteResult.ok) {
        return formatNotFoundMessage('namespaces', name)
      }
      messages.push(formatDeletedMessage('namespace', name, namespace, false))
    }
    return success(messages.join('\n'))
  }

  const messages = names.map((name) => {
    return formatDeletedMessage(resource, name, namespace, false)
  })
  return success(messages.join('\n'))
}
