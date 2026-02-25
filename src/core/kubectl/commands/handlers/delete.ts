import type { ClusterState, ResourceKind } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import {
  createConfigMapDeletedEvent,
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
  return error(`Error from server (NotFound): ${kindRefPlural} "${name}" not found`)
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

const NAMESPACED_EVENT_DELETE_CONFIG: Record<
  NamespacedEventDeleteResource,
  NamespacedDeleteConfig
> = {
  pods: {
    kind: 'Pod',
    kindRef: 'pod',
    emit: (eventBus, name, namespace, resource) => {
      eventBus.emit(createPodDeletedEvent(name, namespace, resource as any, 'kubectl'))
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

  if (!parsed.name) {
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
    const findResult = clusterState.findByKind(
      deleteConfig.kind,
      parsed.name,
      namespace
    )
    if (!findResult.ok) {
      return error(findResult.error)
    }
    deleteConfig.emit(eventBus, parsed.name, namespace, findResult.value)
    return success(
      formatDeletedMessage(deleteConfig.kindRef, parsed.name, namespace, true)
    )
  }

  if (resource === 'deployments') {
    const deleteResult = clusterState.deleteDeployment(parsed.name, namespace)
    if (!deleteResult.ok) {
      return formatNotFoundMessage('deployments.apps', parsed.name)
    }
    return success(
      formatDeletedMessage('deployment.apps', parsed.name, namespace, true)
    )
  }

  if (resource === 'daemonsets') {
    const deleteResult = clusterState.deleteDaemonSet(parsed.name, namespace)
    if (!deleteResult.ok) {
      return formatNotFoundMessage('daemonsets.apps', parsed.name)
    }
    return success(
      formatDeletedMessage('daemonset.apps', parsed.name, namespace, true)
    )
  }

  if (resource === 'services') {
    const deleteResult = clusterState.deleteService(parsed.name, namespace)
    if (!deleteResult.ok) {
      return error(deleteResult.error)
    }
    return success(formatDeletedMessage('service', parsed.name, namespace, true))
  }

  if (resource === 'namespaces') {
    const deleteResult = clusterState.deleteNamespace(parsed.name)
    if (!deleteResult.ok) {
      return formatNotFoundMessage('namespaces', parsed.name)
    }
    return success(formatDeletedMessage('namespace', parsed.name, namespace, false))
  }

  return success(formatDeletedMessage(resource, parsed.name, namespace, false))
}
