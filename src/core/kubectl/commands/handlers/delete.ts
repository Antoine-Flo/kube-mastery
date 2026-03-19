import type { ResourceKind } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { parseKubernetesYaml } from '../../yamlParser'
import type { ParsedCommand } from '../types'
import {
  NO_OBJECTS_PASSED_TO_DELETE,
  resolveManifestFilePathsFromFilenameFlag
} from '../manifestFilePathsFromFlag'

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

type DeleteManifestTargetConfig = {
  kindRef: string
  kindRefPlural: string
  namespaced: boolean
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

const DELETE_TARGET_BY_KIND: Partial<
  Record<ResourceKind, DeleteManifestTargetConfig>
> = {
  Pod: {
    kindRef: 'pod',
    kindRefPlural: 'pods',
    namespaced: true
  },
  ConfigMap: {
    kindRef: 'configmap',
    kindRefPlural: 'configmaps',
    namespaced: true
  },
  Secret: {
    kindRef: 'secret',
    kindRefPlural: 'secrets',
    namespaced: true
  },
  Deployment: {
    kindRef: 'deployment.apps',
    kindRefPlural: 'deployments.apps',
    namespaced: true
  },
  DaemonSet: {
    kindRef: 'daemonset.apps',
    kindRefPlural: 'daemonsets.apps',
    namespaced: true
  },
  StatefulSet: {
    kindRef: 'statefulset.apps',
    kindRefPlural: 'statefulsets.apps',
    namespaced: true
  },
  ReplicaSet: {
    kindRef: 'replicaset.apps',
    kindRefPlural: 'replicasets.apps',
    namespaced: true
  },
  Ingress: {
    kindRef: 'ingress.networking.k8s.io',
    kindRefPlural: 'ingresses.networking.k8s.io',
    namespaced: true
  },
  Service: {
    kindRef: 'service',
    kindRefPlural: 'services',
    namespaced: true
  },
  PersistentVolumeClaim: {
    kindRef: 'persistentvolumeclaim',
    kindRefPlural: 'persistentvolumeclaims',
    namespaced: true
  },
  PersistentVolume: {
    kindRef: 'persistentvolume',
    kindRefPlural: 'persistentvolumes',
    namespaced: false
  },
  Namespace: {
    kindRef: 'namespace',
    kindRefPlural: 'namespaces',
    namespaced: false
  },
  Node: {
    kindRef: 'node',
    kindRefPlural: 'nodes',
    namespaced: false
  }
}

const getFilenameFromFlags = (parsed: ParsedCommand): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

const deleteFromManifest = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  resource: any
): ExecutionResult => {
  const kindRaw = resource?.kind
  const nameRaw = resource?.metadata?.name

  if (typeof kindRaw !== 'string' || typeof nameRaw !== 'string') {
    return error('error: invalid manifest: missing kind or metadata.name')
  }

  const kind = kindRaw as ResourceKind
  const targetConfig = DELETE_TARGET_BY_KIND[kind]
  if (!targetConfig) {
    return error(
      `error: the server doesn't have a resource type "${kind.toLowerCase()}s"`
    )
  }

  const namespaceRaw = resource?.metadata?.namespace
  const namespaceFromManifest =
    typeof namespaceRaw === 'string' && namespaceRaw.length > 0
      ? namespaceRaw
      : undefined
  const namespace = parsed.namespace ?? namespaceFromManifest ?? 'default'

  if (kind === 'Namespace') {
    const existingNamespace = apiServer.findResource('Namespace', nameRaw)
    if (!existingNamespace.ok) {
      return formatNotFoundMessage(targetConfig.kindRefPlural, nameRaw)
    }
    const cascadeResult = deleteNamespacedResourcesForNamespace(apiServer, nameRaw)
    if (cascadeResult != null) {
      return cascadeResult
    }
    const deleteNamespaceResult = apiServer.deleteResource('Namespace', nameRaw)
    if (!deleteNamespaceResult.ok) {
      return formatNotFoundMessage(targetConfig.kindRefPlural, nameRaw)
    }
    return success(
      formatDeletedMessage(targetConfig.kindRef, nameRaw, namespace, false)
    )
  }

  if (targetConfig.namespaced) {
    const deleteResult = apiServer.deleteResource(kind, nameRaw, namespace)
    if (!deleteResult.ok) {
      return formatNotFoundMessage(targetConfig.kindRefPlural, nameRaw)
    }
    return success(
      formatDeletedMessage(targetConfig.kindRef, nameRaw, namespace, true)
    )
  }

  const deleteResult = apiServer.deleteResource(kind, nameRaw)
  if (!deleteResult.ok) {
    return formatNotFoundMessage(targetConfig.kindRefPlural, nameRaw)
  }
  return success(
    formatDeletedMessage(targetConfig.kindRef, nameRaw, namespace, false)
  )
}

/**
 * Handle kubectl delete command
 * Uses event-driven architecture to delete resources
 */
export const handleDelete = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  fileSystem?: FileSystem
): ExecutionResult => {
  const filename = getFilenameFromFlags(parsed)
  if (filename != null) {
    if (fileSystem == null) {
      return error('error: internal error: filesystem is not available')
    }
    const pathsResult = resolveManifestFilePathsFromFilenameFlag(
      fileSystem,
      filename,
      NO_OBJECTS_PASSED_TO_DELETE
    )
    if (!pathsResult.ok) {
      return pathsResult
    }
    const filesResult = fileSystem.readFiles(pathsResult.value)
    if (!filesResult.ok) {
      return error(`error: ${filesResult.error}`)
    }
    const lines: string[] = []
    for (let i = 0; i < filesResult.value.length; i++) {
      const parseResult = parseKubernetesYaml(filesResult.value[i])
      if (!parseResult.ok) {
        return error(`error: ${parseResult.error}`)
      }
      const deleteResult = deleteFromManifest(
        apiServer,
        parsed,
        parseResult.value
      )
      if (!deleteResult.ok) {
        return deleteResult
      }
      lines.push(deleteResult.value)
    }
    return success(lines.join('\n'))
  }

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

  if (resource === 'statefulsets') {
    const messages: string[] = []
    for (const name of names) {
      const deleteResult = apiServer.deleteResource('StatefulSet', name, namespace)
      if (!deleteResult.ok) {
        return formatNotFoundMessage('statefulsets.apps', name)
      }
      messages.push(
        formatDeletedMessage('statefulset.apps', name, namespace, true)
      )
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
