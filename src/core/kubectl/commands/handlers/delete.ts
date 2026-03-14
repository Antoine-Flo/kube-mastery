import type { ResourceKind } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
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
}

const deleteNamespacedResourcesForNamespace = (
  apiServer: ApiServerFacade,
  namespace: string
): ExecutionResult | undefined => {
  const pods = apiServer.listResources('Pod', namespace)
  for (const pod of pods) {
    const result = apiServer.deleteResource('Pod', pod.metadata.name, namespace)
    if (!result.ok) {
      return result
    }
  }

  const configMaps = apiServer.listResources('ConfigMap', namespace)
  for (const configMap of configMaps) {
    const result = apiServer.deleteResource(
      'ConfigMap',
      configMap.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const secrets = apiServer.listResources('Secret', namespace)
  for (const secret of secrets) {
    const result = apiServer.deleteResource('Secret', secret.metadata.name, namespace)
    if (!result.ok) {
      return result
    }
  }

  const deployments = apiServer.listResources('Deployment', namespace)
  for (const deployment of deployments) {
    const result = apiServer.deleteResource(
      'Deployment',
      deployment.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const daemonSets = apiServer.listResources('DaemonSet', namespace)
  for (const daemonSet of daemonSets) {
    const result = apiServer.deleteResource(
      'DaemonSet',
      daemonSet.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const replicaSets = apiServer.listResources('ReplicaSet', namespace)
  for (const replicaSet of replicaSets) {
    const result = apiServer.deleteResource(
      'ReplicaSet',
      replicaSet.metadata.name,
      namespace
    )
    if (!result.ok) {
      return result
    }
  }

  const services = apiServer.listResources('Service', namespace)
  for (const service of services) {
    const result = apiServer.deleteResource('Service', service.metadata.name, namespace)
    if (!result.ok) {
      return result
    }
  }

  const persistentVolumeClaims = apiServer.listResources(
    'PersistentVolumeClaim',
    namespace
  )
  for (const persistentVolumeClaim of persistentVolumeClaims) {
    const result = apiServer.deleteResource(
      'PersistentVolumeClaim',
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
    kindRef: 'pod'
  },
  configmaps: {
    kind: 'ConfigMap',
    kindRef: 'configmap'
  },
  secrets: {
    kind: 'Secret',
    kindRef: 'secret'
  }
}

/**
 * Handle kubectl delete command
 * Uses event-driven architecture to delete resources
 */
export const handleDelete = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
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
      const deleteResult = apiServer.deleteResource(deleteConfig.kind, name, namespace)
      if (!deleteResult.ok) {
        return error(deleteResult.error)
      }
      messages.push(
        formatDeletedMessage(deleteConfig.kindRef, name, namespace, true)
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'deployments') {
    const messages: string[] = []
    for (const name of names) {
      const deleteResult = apiServer.deleteResource('Deployment', name, namespace)
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
      const deleteResult = apiServer.deleteResource('DaemonSet', name, namespace)
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
      const deleteResult = apiServer.deleteResource('Service', name, namespace)
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
      const deleteResult = apiServer.deleteResource('Ingress', name, namespace)
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
      const deleteResult = apiServer.deleteResource('PersistentVolume', name)
      if (!deleteResult.ok) {
        return formatNotFoundMessage('persistentvolumes', name)
      }
      messages.push(
        formatDeletedMessage('persistentvolume', name, namespace, false)
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'persistentvolumeclaims') {
    const messages: string[] = []
    for (const name of names) {
      const deleteResult = apiServer.deleteResource(
        'PersistentVolumeClaim',
        name,
        namespace
      )
      if (!deleteResult.ok) {
        return formatNotFoundMessage('persistentvolumeclaims', name)
      }
      messages.push(
        formatDeletedMessage('persistentvolumeclaim', name, namespace, true)
      )
    }
    return success(messages.join('\n'))
  }

  if (resource === 'namespaces') {
    const messages: string[] = []
    for (const name of names) {
      const existingNamespace = apiServer.findResource('Namespace', name)
      if (!existingNamespace.ok) {
        return formatNotFoundMessage('namespaces', name)
      }
      const cascadeResult = deleteNamespacedResourcesForNamespace(apiServer, name)
      if (cascadeResult != null) {
        return cascadeResult
      }
      const deleteResult = apiServer.deleteResource('Namespace', name)
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
