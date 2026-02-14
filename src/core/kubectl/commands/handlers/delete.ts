import type { ClusterState } from '../../../cluster/ClusterState'
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

  if (resource === 'pods') {
    const findResult = clusterState.findPod(parsed.name, namespace)
    if (!findResult.ok) {
      return error(findResult.error)
    }
    eventBus.emit(
      createPodDeletedEvent(parsed.name, namespace, findResult.value, 'kubectl')
    )
    return success(formatDeletedMessage('pod', parsed.name, namespace, true))
  }

  if (resource === 'configmaps') {
    const findResult = clusterState.findConfigMap(parsed.name, namespace)
    if (!findResult.ok) {
      return error(findResult.error)
    }
    eventBus.emit(
      createConfigMapDeletedEvent(
        parsed.name,
        namespace,
        findResult.value,
        'kubectl'
      )
    )
    return success(formatDeletedMessage('configmap', parsed.name, namespace, true))
  }

  if (resource === 'secrets') {
    const findResult = clusterState.findSecret(parsed.name, namespace)
    if (!findResult.ok) {
      return error(findResult.error)
    }
    eventBus.emit(
      createSecretDeletedEvent(
        parsed.name,
        namespace,
        findResult.value,
        'kubectl'
      )
    )
    return success(formatDeletedMessage('secret', parsed.name, namespace, true))
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

  if (resource === 'services') {
    const deleteResult = clusterState.deleteService(parsed.name, namespace)
    if (!deleteResult.ok) {
      return error(deleteResult.error)
    }
    return success(formatDeletedMessage('service', parsed.name, namespace, true))
  }

  if (resource === 'namespaces') {
    return success(formatDeletedMessage('namespace', parsed.name, namespace, false))
  }

  return success(formatDeletedMessage(resource, parsed.name, namespace, false))
}
