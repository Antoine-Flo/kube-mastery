import type { ResourceKind } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { parseKubernetesYaml } from '../../yamlParser'
import type { ParsedCommand, Resource } from '../types'
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
  kind: ResourceKind
  kindRef: string
  kindRefPlural: string
  namespaced: boolean
}

type PodDeleteOptions = {
  gracePeriodSeconds?: number
  force?: boolean
}

const getPodDeleteOptions = (parsed: ParsedCommand): PodDeleteOptions => {
  const options: PodDeleteOptions = {}
  if (parsed.deleteGracePeriodSeconds != null) {
    options.gracePeriodSeconds = parsed.deleteGracePeriodSeconds
  }
  if (parsed.deleteForce === true) {
    options.force = true
  }
  return options
}

const deleteNamespacedResourcesForNamespace = (
  apiServer: ApiServerFacade,
  namespace: string
): ExecutionResult | undefined => {
  const pods = apiServer.listResources('Pod', namespace)
  for (const pod of pods) {
    const requestResult = apiServer.requestPodDeletion(pod.metadata.name, namespace, {
      gracePeriodSeconds: 0,
      force: true,
      source: 'namespace-cascade-delete'
    })
    if (!requestResult.ok) {
      return requestResult
    }
    const finalizeResult = apiServer.finalizePodDeletion(pod.metadata.name, namespace, {
      source: 'namespace-cascade-delete'
    })
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
    kind: 'Pod',
    kindRef: 'pod',
    kindRefPlural: 'pods',
    namespaced: true
  },
  ConfigMap: {
    kind: 'ConfigMap',
    kindRef: 'configmap',
    kindRefPlural: 'configmaps',
    namespaced: true
  },
  Secret: {
    kind: 'Secret',
    kindRef: 'secret',
    kindRefPlural: 'secrets',
    namespaced: true
  },
  Deployment: {
    kind: 'Deployment',
    kindRef: 'deployment.apps',
    kindRefPlural: 'deployments.apps',
    namespaced: true
  },
  DaemonSet: {
    kind: 'DaemonSet',
    kindRef: 'daemonset.apps',
    kindRefPlural: 'daemonsets.apps',
    namespaced: true
  },
  StatefulSet: {
    kind: 'StatefulSet',
    kindRef: 'statefulset.apps',
    kindRefPlural: 'statefulsets.apps',
    namespaced: true
  },
  ReplicaSet: {
    kind: 'ReplicaSet',
    kindRef: 'replicaset.apps',
    kindRefPlural: 'replicasets.apps',
    namespaced: true
  },
  Ingress: {
    kind: 'Ingress',
    kindRef: 'ingress.networking.k8s.io',
    kindRefPlural: 'ingresses.networking.k8s.io',
    namespaced: true
  },
  Service: {
    kind: 'Service',
    kindRef: 'service',
    kindRefPlural: 'services',
    namespaced: true
  },
  PersistentVolumeClaim: {
    kind: 'PersistentVolumeClaim',
    kindRef: 'persistentvolumeclaim',
    kindRefPlural: 'persistentvolumeclaims',
    namespaced: true
  },
  PersistentVolume: {
    kind: 'PersistentVolume',
    kindRef: 'persistentvolume',
    kindRefPlural: 'persistentvolumes',
    namespaced: false
  },
  Namespace: {
    kind: 'Namespace',
    kindRef: 'namespace',
    kindRefPlural: 'namespaces',
    namespaced: false
  },
  Node: {
    kind: 'Node',
    kindRef: 'node',
    kindRefPlural: 'nodes',
    namespaced: false
  }
}

type DeletableResource = Exclude<Resource, 'all' | 'ingressclasses'>

const DELETE_TARGET_BY_RESOURCE: Partial<
  Record<DeletableResource, DeleteManifestTargetConfig>
> = {
  pods: DELETE_TARGET_BY_KIND.Pod,
  configmaps: DELETE_TARGET_BY_KIND.ConfigMap,
  secrets: DELETE_TARGET_BY_KIND.Secret,
  deployments: DELETE_TARGET_BY_KIND.Deployment,
  daemonsets: DELETE_TARGET_BY_KIND.DaemonSet,
  statefulsets: DELETE_TARGET_BY_KIND.StatefulSet,
  replicasets: DELETE_TARGET_BY_KIND.ReplicaSet,
  services: DELETE_TARGET_BY_KIND.Service,
  ingresses: DELETE_TARGET_BY_KIND.Ingress,
  persistentvolumes: DELETE_TARGET_BY_KIND.PersistentVolume,
  persistentvolumeclaims: DELETE_TARGET_BY_KIND.PersistentVolumeClaim,
  namespaces: DELETE_TARGET_BY_KIND.Namespace,
  nodes: DELETE_TARGET_BY_KIND.Node
}

const DELETE_ALL_RESOURCE_ORDER: DeletableResource[] = [
  'pods',
  'services',
  'daemonsets',
  'deployments',
  'replicasets'
]

const getDeleteTargetConfig = (
  resource: Resource
): DeleteManifestTargetConfig | undefined => {
  if (resource === 'all' || resource === 'ingressclasses') {
    return undefined
  }
  return DELETE_TARGET_BY_RESOURCE[resource]
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

const deleteSingleResource = (
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
        ? apiServer.deleteResource(config.kind, name, namespace, podDeleteOptions)
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

const deleteMatchingResourcesForType = (
  apiServer: ApiServerFacade,
  config: DeleteManifestTargetConfig,
  namespace: string,
  selector: Record<string, string> | undefined,
  podDeleteOptions: PodDeleteOptions
): ExecutionResult => {
  const names = listMatchingResourceNames(apiServer, config, namespace, selector)
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

const deleteAllMatchingResources = (
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
    const names = listMatchingResourceNames(apiServer, config, namespace, selector)
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
  const podDeleteOptions = getPodDeleteOptions(parsed)

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
    const deleteResult =
      kind === 'Pod'
        ? apiServer.deleteResource(kind, nameRaw, namespace, podDeleteOptions)
        : apiServer.deleteResource(kind, nameRaw, namespace)
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
  const podDeleteOptions = getPodDeleteOptions(parsed)
  const resource = parsed.resource
  if (!resource) {
    return error('error: you must specify a resource type')
  }

  const names =
    parsed.names != null && parsed.names.length > 0
      ? parsed.names
      : parsed.name != null
        ? [parsed.name]
        : []

  if (names.length === 0) {
    if (resource === 'all') {
      return deleteAllMatchingResources(
        apiServer,
        namespace,
        parsed.selector,
        podDeleteOptions
      )
    }
    if (parsed.selector != null) {
      const selectorConfig = getDeleteTargetConfig(resource)
      if (!selectorConfig) {
        return error(`Resource type "${resource}" is not supported`)
      }
      return deleteMatchingResourcesForType(
        apiServer,
        selectorConfig,
        namespace,
        parsed.selector,
        podDeleteOptions
      )
    }
    return error(`error: you must specify the name of the resource to delete`)
  }

  if (resource === 'all') {
    return error('error: deleting "all" with explicit names is not supported')
  }

  if (
    resource === 'pods' ||
    resource === 'configmaps' ||
    resource === 'secrets'
  ) {
    const deleteConfig = NAMESPACED_EVENT_DELETE_CONFIG[resource]
    const messages: string[] = []
    for (const name of names) {
      const deleteResult =
        deleteConfig.kind === 'Pod'
          ? apiServer.deleteResource(
              deleteConfig.kind,
              name,
              namespace,
              podDeleteOptions
            )
          : apiServer.deleteResource(deleteConfig.kind, name, namespace)
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
