import type { KindToResource, ResourceKind } from '../../cluster/ClusterState'
import type { ApiServerFacade } from '../../api/ApiServerFacade'
import {
  createConfigMapAnnotatedEvent,
  createConfigMapLabeledEvent,
  createPodAnnotatedEvent,
  createPodLabeledEvent,
  createSecretAnnotatedEvent,
  createSecretLabeledEvent
} from '../../cluster/events/types'
import type { ConfigMap } from '../../cluster/ressources/ConfigMap'
import type { Pod } from '../../cluster/ressources/Pod'
import type { Secret } from '../../cluster/ressources/Secret'
import { deepFreeze } from '../../shared/deepFreeze'
import type { ExecutionResult, Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { ParsedCommand } from './types'
import { RESOURCE_KIND_BY_RESOURCE } from './resourceHelpers'

// ═══════════════════════════════════════════════════════════════════════════
// METADATA HELPERS (LABELS & ANNOTATIONS)
// ═══════════════════════════════════════════════════════════════════════════
// Generic helpers for handling labels and annotations on Kubernetes resources

type ResourceWithMetadata = {
  metadata: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
    namespace: string
    name: string
  }
}
type MetadataType = 'labels' | 'annotations'

/**
 * Apply metadata changes (labels or annotations) to a resource
 * Returns error if trying to overwrite without --overwrite flag
 */
/**
 * Remove a key from metadata object (pure function)
 */
const removeKey = (
  metadata: Record<string, string>,
  key: string
): Record<string, string> => {
  return Object.fromEntries(Object.entries(metadata).filter(([k]) => k !== key))
}

const applyMetadataChanges = (
  resource: ResourceWithMetadata,
  changes: Record<string, string | null>,
  overwrite: boolean,
  metadataType: MetadataType
): Result<ResourceWithMetadata> => {
  const currentMetadata = resource.metadata[metadataType] || {}
  let newMetadata = { ...currentMetadata }

  // Apply each change
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) {
      // Removal: key- (filter out the key)
      newMetadata = removeKey(newMetadata, key)
    } else {
      // Addition or update
      if (currentMetadata[key] !== undefined && !overwrite) {
        const type = metadataType === 'labels' ? 'label' : 'annotation'
        return error(
          `${type} "${key}" already exists, use --overwrite to update`
        )
      }
      newMetadata = { ...newMetadata, [key]: value }
    }
  }

  // Create updated resource with new metadata
  const updated = {
    ...resource,
    metadata: {
      ...resource.metadata,
      [metadataType]:
        Object.keys(newMetadata).length > 0 ? newMetadata : undefined
    }
  }

  return success(deepFreeze(updated) as ResourceWithMetadata)
}

/**
 * Configuration for metadata operation
 */
interface MetadataOperationConfig {
  metadataType: MetadataType
  commandName: 'label' | 'annotate'
  changesKey: 'labelChanges' | 'annotationChanges'
  actionPastTense: 'labeled' | 'annotated'
}

/**
 * Resource collection accessor - declarative mapping
 */
interface ResourceCollectionAccessor {
  kind: ResourceKind
  singularName: string // For success messages (lowercase: "pod")
}

/**
 * Resource collection accessors (object lookup pattern)
 */
const RESOURCE_ACCESSORS: Partial<Record<string, ResourceCollectionAccessor>> =
  {
    pods: {
      kind: RESOURCE_KIND_BY_RESOURCE.pods ?? 'Pod',
      singularName: 'pod'
    },
    configmaps: {
      kind: RESOURCE_KIND_BY_RESOURCE.configmaps ?? 'ConfigMap',
      singularName: 'configmap'
    },
    secrets: {
      kind: RESOURCE_KIND_BY_RESOURCE.secrets ?? 'Secret',
      singularName: 'secret'
    },
    deployments: {
      kind: RESOURCE_KIND_BY_RESOURCE.deployments ?? 'Deployment',
      singularName: 'deployment'
    },
    services: {
      kind: RESOURCE_KIND_BY_RESOURCE.services ?? 'Service',
      singularName: 'service'
    },
    namespaces: {
      kind: RESOURCE_KIND_BY_RESOURCE.namespaces ?? 'Namespace',
      singularName: 'namespace'
    },
    nodes: {
      kind: RESOURCE_KIND_BY_RESOURCE.nodes ?? 'Node',
      singularName: 'node'
    },
    daemonsets: {
      kind: RESOURCE_KIND_BY_RESOURCE.daemonsets ?? 'DaemonSet',
      singularName: 'daemonset'
    },
    statefulsets: {
      kind: RESOURCE_KIND_BY_RESOURCE.statefulsets ?? 'StatefulSet',
      singularName: 'statefulset'
    },
    replicasets: {
      kind: RESOURCE_KIND_BY_RESOURCE.replicasets ?? 'ReplicaSet',
      singularName: 'replicaset'
    },
    ingresses: {
      kind: RESOURCE_KIND_BY_RESOURCE.ingresses ?? 'Ingress',
      singularName: 'ingress'
    },
    networkpolicies: {
      kind: RESOURCE_KIND_BY_RESOURCE.networkpolicies ?? 'NetworkPolicy',
      singularName: 'networkpolicy'
    },
    persistentvolumes: {
      kind: RESOURCE_KIND_BY_RESOURCE.persistentvolumes ?? 'PersistentVolume',
      singularName: 'persistentvolume'
    },
    persistentvolumeclaims: {
      kind:
        RESOURCE_KIND_BY_RESOURCE.persistentvolumeclaims ??
        'PersistentVolumeClaim',
      singularName: 'persistentvolumeclaim'
    }
  }

/**
 * Generic handler for metadata changes (labels or annotations)
 * Uses event-driven architecture to apply changes
 */
export const handleMetadataChange = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  config: MetadataOperationConfig
): ExecutionResult => {
  const namespace = parsed.namespace || 'default'

  // Validate resource type
  if (!parsed.resource) {
    return error(
      `error: you must specify the resource type to ${config.commandName}`
    )
  }

  // Validate resource name
  if (!parsed.name) {
    return error(
      `error: you must specify the name of the resource to ${config.commandName}`
    )
  }

  // Validate metadata changes
  const changes = parsed[config.changesKey]
  if (!changes || Object.keys(changes).length === 0) {
    const changeName = config.metadataType === 'labels' ? 'label' : 'annotation'
    return error(`No ${changeName} changes provided`)
  }

  const overwrite = parsed.flags['overwrite'] === true

  return handleMetadataChangeWithEvents(
    parsed.resource,
    parsed.name,
    namespace,
    changes,
    overwrite,
    config,
    apiServer
  )
}

/**
 * Handle metadata changes with event emission
 * Event-driven approach that emits appropriate events
 */
const handleMetadataChangeWithEvents = (
  resourceType: string,
  name: string,
  namespace: string,
  changes: Record<string, string | null>,
  overwrite: boolean,
  config: MetadataOperationConfig,
  apiServer: ApiServerFacade
): ExecutionResult => {
  const accessor = RESOURCE_ACCESSORS[resourceType]
  if (!accessor) {
    return error(`Resource type "${resourceType}" is not supported`)
  }

  const resourceResult =
    accessor.kind === 'Node' ||
    accessor.kind === 'Namespace' ||
    accessor.kind === 'PersistentVolume'
      ? apiServer.findResource(accessor.kind, name)
      : apiServer.findResource(accessor.kind, name, namespace)
  if (!resourceResult.ok) {
    return error(
      `Error from server (NotFound): ${resourceType} "${name}" not found`
    )
  }
  const resource = resourceResult.value as ResourceWithMetadata

  // Apply metadata changes
  const updateResult = applyMetadataChanges(
    resource,
    changes,
    overwrite,
    config.metadataType
  )
  if (!updateResult.ok) {
    return updateResult
  }

  const updatedResource = updateResult.value as KindToResource<
    typeof accessor.kind
  >
  const metadataKey = config.metadataType
  const metadataForEvents = updatedResource.metadata as ResourceWithMetadata['metadata']
  const metadataValue = metadataForEvents[metadataKey] || {}

  // Emit appropriate event based on resource type and metadata type
  if (accessor.kind === 'Pod') {
    const pod = resource as Pod
    const updatedPod = updatedResource as Pod
    // Kubernetes watches observe Pod metadata edits as Pod update events.
    // Emit PodUpdated through the API facade first so controllers reconcile immediately.
    const podUpdateResult = apiServer.updateResource(
      'Pod',
      name,
      updatedPod,
      namespace
    )
    if (!podUpdateResult.ok) {
      return error(podUpdateResult.error)
    }
    const event =
      metadataKey === 'labels'
        ? createPodLabeledEvent(
            name,
            namespace,
            metadataValue,
            updatedPod,
            pod,
            'kubectl'
          )
        : createPodAnnotatedEvent(
            name,
            namespace,
            metadataValue,
            updatedPod,
            pod,
            'kubectl'
          )
    apiServer.emitEvent(event)
  } else if (accessor.kind === 'ConfigMap') {
    const configMap = resource as ConfigMap
    const updatedConfigMap = updatedResource as ConfigMap
    const event =
      metadataKey === 'labels'
        ? createConfigMapLabeledEvent(
            name,
            namespace,
            metadataValue,
            updatedConfigMap,
            configMap,
            'kubectl'
          )
        : createConfigMapAnnotatedEvent(
            name,
            namespace,
            metadataValue,
            updatedConfigMap,
            configMap,
            'kubectl'
          )
    apiServer.emitEvent(event)
  } else if (accessor.kind === 'Secret') {
    const secret = resource as Secret
    const updatedSecret = updatedResource as Secret
    const event =
      metadataKey === 'labels'
        ? createSecretLabeledEvent(
            name,
            namespace,
            metadataValue,
            updatedSecret,
            secret,
            'kubectl'
          )
        : createSecretAnnotatedEvent(
            name,
            namespace,
            metadataValue,
            updatedSecret,
            secret,
            'kubectl'
          )
    apiServer.emitEvent(event)
  } else {
    const updateResult = isClusterScopedKind(accessor.kind)
      ? apiServer.updateResource(accessor.kind, name, updatedResource)
      : apiServer.updateResource(
          accessor.kind,
          name,
          updatedResource,
          namespace
        )
    if (!updateResult.ok) {
      return error(updateResult.error)
    }
  }

  const allRemovals = Object.values(changes).every((value) => value === null)
  const pastTense =
    allRemovals && config.metadataType === 'labels'
      ? 'unlabeled'
      : config.actionPastTense

  return {
    ok: true,
    value: `${accessor.singularName}/${name} ${pastTense}`
  }
}

const isClusterScopedKind = (kind: ResourceKind): boolean => {
  if (kind === 'Node' || kind === 'Namespace' || kind === 'PersistentVolume') {
    return true
  }
  return false
}
