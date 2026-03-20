import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../../../shared/result'
import { error, success } from '../../../../../shared/result'
import type { Resource } from '../../../types'
import { DELETE_ALL_RESOURCE_ORDER, DELETE_TARGET_BY_RESOURCE } from './config'
import { formatDeletedMessage, formatNotFoundMessage } from './messages'
import type { DeleteManifestTargetConfig, PodDeleteOptions } from './types'

export const deleteNamespacedResourcesForNamespace = (
  apiServer: ApiServerFacade,
  namespace: string
): ExecutionResult | undefined => {
  const pods = apiServer.listResources('Pod', namespace)
  for (const pod of pods) {
    const requestResult = apiServer.requestPodDeletion(
      pod.metadata.name,
      namespace,
      {
        gracePeriodSeconds: 0,
        force: true,
        source: 'namespace-cascade-delete'
      }
    )
    if (!requestResult.ok) {
      return requestResult
    }
    const finalizeResult = apiServer.finalizePodDeletion(
      pod.metadata.name,
      namespace,
      {
        source: 'namespace-cascade-delete'
      }
    )
    if (!finalizeResult.ok) {
      return finalizeResult
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
    const result = apiServer.deleteResource(
      'Secret',
      secret.metadata.name,
      namespace
    )
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

  const statefulSets = apiServer.listResources('StatefulSet', namespace)
  for (const statefulSet of statefulSets) {
    const result = apiServer.deleteResource(
      'StatefulSet',
      statefulSet.metadata.name,
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
    const result = apiServer.deleteResource(
      'Service',
      service.metadata.name,
      namespace
    )
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

const matchesSelector = (
  labels: Record<string, string> | undefined,
  selector: Record<string, string> | undefined
): boolean => {
  if (selector == null) {
    return true
  }
  if (labels == null) {
    return false
  }
  for (const [key, value] of Object.entries(selector)) {
    if (labels[key] !== value) {
      return false
    }
  }
  return true
}

const listMatchingResourceNames = (
  apiServer: ApiServerFacade,
  config: DeleteManifestTargetConfig,
  namespace: string,
  selector: Record<string, string> | undefined
): string[] => {
  const resources = config.namespaced
    ? apiServer.listResources(config.kind, namespace)
    : apiServer.listResources(config.kind)
  return resources
    .filter((resource) => {
      return matchesSelector(resource.metadata.labels, selector)
    })
    .map((resource) => {
      return resource.metadata.name
    })
}

export const deleteSingleResource = (
  apiServer: ApiServerFacade,
  config: DeleteManifestTargetConfig,
  name: string,
  namespace: string,
  podDeleteOptions: PodDeleteOptions
): ExecutionResult => {
  if (config.kind === 'Namespace') {
    const existingNamespace = apiServer.findResource('Namespace', name)
    if (!existingNamespace.ok) {
      return formatNotFoundMessage(config.kindRefPlural, name)
    }
    const cascadeResult = deleteNamespacedResourcesForNamespace(apiServer, name)
    if (cascadeResult != null) {
      return cascadeResult
    }
    const deleteNamespaceResult = apiServer.deleteResource('Namespace', name)
    if (!deleteNamespaceResult.ok) {
      return formatNotFoundMessage(config.kindRefPlural, name)
    }
    return success(formatDeletedMessage(config.kindRef, name, namespace, false))
  }

  if (config.namespaced) {
    const deleteResult =
      config.kind === 'Pod'
        ? apiServer.deleteResource(
            config.kind,
            name,
            namespace,
            podDeleteOptions
          )
        : apiServer.deleteResource(config.kind, name, namespace)
    if (!deleteResult.ok) {
      return formatNotFoundMessage(config.kindRefPlural, name)
    }
    return success(formatDeletedMessage(config.kindRef, name, namespace, true))
  }

  const deleteResult = apiServer.deleteResource(config.kind, name)
  if (!deleteResult.ok) {
    return formatNotFoundMessage(config.kindRefPlural, name)
  }
  return success(formatDeletedMessage(config.kindRef, name, namespace, false))
}

export const deleteMatchingResourcesForType = (
  apiServer: ApiServerFacade,
  config: DeleteManifestTargetConfig,
  namespace: string,
  selector: Record<string, string> | undefined,
  podDeleteOptions: PodDeleteOptions
): ExecutionResult => {
  const names = listMatchingResourceNames(
    apiServer,
    config,
    namespace,
    selector
  )
  if (names.length === 0) {
    return success('No resources found')
  }
  const messages: string[] = []
  for (const name of names) {
    const deleteResult = deleteSingleResource(
      apiServer,
      config,
      name,
      namespace,
      podDeleteOptions
    )
    if (!deleteResult.ok) {
      return deleteResult
    }
    messages.push(deleteResult.value)
  }
  return success(messages.join('\n'))
}

export const deleteAllMatchingResources = (
  apiServer: ApiServerFacade,
  namespace: string,
  selector: Record<string, string> | undefined,
  podDeleteOptions: PodDeleteOptions
): ExecutionResult => {
  const messages: string[] = []
  for (const resource of DELETE_ALL_RESOURCE_ORDER) {
    const config = DELETE_TARGET_BY_RESOURCE[resource]
    if (!config) {
      continue
    }
    const names = listMatchingResourceNames(
      apiServer,
      config,
      namespace,
      selector
    )
    for (const name of names) {
      const deleteResult = deleteSingleResource(
        apiServer,
        config,
        name,
        namespace,
        podDeleteOptions
      )
      if (!deleteResult.ok) {
        return deleteResult
      }
      messages.push(deleteResult.value)
    }
  }
  if (messages.length === 0) {
    return success('No resources found')
  }
  return success(messages.join('\n'))
}

const deleteWithNotFoundMessage = (
  apiServer: ApiServerFacade,
  kind: DeleteManifestTargetConfig['kind'],
  name: string,
  namespace: string,
  notFoundPlural: string,
  kindRef: string,
  namespaced: boolean
): ExecutionResult => {
  const deleteResult = namespaced
    ? apiServer.deleteResource(kind, name, namespace)
    : apiServer.deleteResource(kind, name)
  if (!deleteResult.ok) {
    return formatNotFoundMessage(notFoundPlural, name)
  }
  return success(formatDeletedMessage(kindRef, name, namespace, namespaced))
}

export const deleteNamedResources = (
  apiServer: ApiServerFacade,
  resource: Resource,
  names: string[],
  namespace: string,
  podDeleteOptions: PodDeleteOptions
): ExecutionResult => {
  if (
    resource === 'pods' ||
    resource === 'configmaps' ||
    resource === 'secrets'
  ) {
    const kind =
      resource === 'pods'
        ? 'Pod'
        : resource === 'configmaps'
          ? 'ConfigMap'
          : 'Secret'
    const kindRef =
      resource === 'pods'
        ? 'pod'
        : resource === 'configmaps'
          ? 'configmap'
          : 'secret'
    const messages: string[] = []
    for (const name of names) {
      const deleteResult =
        kind === 'Pod'
          ? apiServer.deleteResource(kind, name, namespace, podDeleteOptions)
          : apiServer.deleteResource(kind, name, namespace)
      if (!deleteResult.ok) {
        return error(deleteResult.error)
      }
      messages.push(formatDeletedMessage(kindRef, name, namespace, true))
    }
    return success(messages.join('\n'))
  }

  if (resource === 'deployments') {
    const messages: string[] = []
    for (const name of names) {
      const result = deleteWithNotFoundMessage(
        apiServer,
        'Deployment',
        name,
        namespace,
        'deployments.apps',
        'deployment.apps',
        true
      )
      if (!result.ok) {
        return result
      }
      messages.push(result.value)
    }
    return success(messages.join('\n'))
  }

  if (resource === 'daemonsets') {
    const messages: string[] = []
    for (const name of names) {
      const result = deleteWithNotFoundMessage(
        apiServer,
        'DaemonSet',
        name,
        namespace,
        'daemonsets.apps',
        'daemonset.apps',
        true
      )
      if (!result.ok) {
        return result
      }
      messages.push(result.value)
    }
    return success(messages.join('\n'))
  }

  if (resource === 'statefulsets') {
    const messages: string[] = []
    for (const name of names) {
      const result = deleteWithNotFoundMessage(
        apiServer,
        'StatefulSet',
        name,
        namespace,
        'statefulsets.apps',
        'statefulset.apps',
        true
      )
      if (!result.ok) {
        return result
      }
      messages.push(result.value)
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
      const result = deleteWithNotFoundMessage(
        apiServer,
        'Ingress',
        name,
        namespace,
        'ingresses.networking.k8s.io',
        'ingress.networking.k8s.io',
        true
      )
      if (!result.ok) {
        return result
      }
      messages.push(result.value)
    }
    return success(messages.join('\n'))
  }

  if (resource === 'persistentvolumes') {
    const messages: string[] = []
    for (const name of names) {
      const result = deleteWithNotFoundMessage(
        apiServer,
        'PersistentVolume',
        name,
        namespace,
        'persistentvolumes',
        'persistentvolume',
        false
      )
      if (!result.ok) {
        return result
      }
      messages.push(result.value)
    }
    return success(messages.join('\n'))
  }

  if (resource === 'persistentvolumeclaims') {
    const messages: string[] = []
    for (const name of names) {
      const result = deleteWithNotFoundMessage(
        apiServer,
        'PersistentVolumeClaim',
        name,
        namespace,
        'persistentvolumeclaims',
        'persistentvolumeclaim',
        true
      )
      if (!result.ok) {
        return result
      }
      messages.push(result.value)
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
      const cascadeResult = deleteNamespacedResourcesForNamespace(
        apiServer,
        name
      )
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

  if (resource === 'leases') {
    const messages: string[] = []
    for (const name of names) {
      const result = deleteWithNotFoundMessage(
        apiServer,
        'Lease',
        name,
        namespace,
        'leases',
        'lease',
        true
      )
      if (!result.ok) {
        return result
      }
      messages.push(result.value)
    }
    return success(messages.join('\n'))
  }

  const messages = names.map((name) => {
    return formatDeletedMessage(resource, name, namespace, false)
  })
  return success(messages.join('\n'))
}
