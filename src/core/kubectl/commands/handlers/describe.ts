import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { PodLifecycleDescribeEvent } from '../../../api/PodLifecycleEventStore'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import {
  describeConfigMap,
  describeDeployment,
  describeEndpointSlice,
  describeEndpoints,
  describeIngress,
  describeLease,
  describeNode,
  describePersistentVolume,
  describePersistentVolumeClaim,
  describePod,
  describeReplicaSet,
  describeSecret,
  describeService
} from '../../formatters/describeFormatters'
import type { ParsedCommand } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL DESCRIBE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Configuration-driven approach: each resource defines its collection and formatter

/**
 * Resource describe configuration
 * Declarative approach similar to get.ts RESOURCE_HANDLERS
 */
interface DescribeConfig {
  items: keyof ClusterStateData
  formatter: (
    item: any,
    state: ClusterStateData,
    dependencies: DescribeDependencies
  ) => string
  type: string
  isClusterScoped?: boolean
}

interface DescribeableResource {
  metadata: {
    name: string
    namespace: string
  }
}

interface DescribeDependencies {
  listPodEvents?: (
    namespace: string,
    podName: string
  ) => readonly PodLifecycleDescribeEvent[]
}

const findDescribeResource = (
  collection: DescribeableResource[],
  name: string,
  namespace: string,
  isClusterScoped: boolean
): DescribeableResource | undefined => {
  if (isClusterScoped) {
    return collection.find((item) => {
      return item.metadata.name === name
    })
  }
  return collection.find((item) => {
    return item.metadata.name === name && item.metadata.namespace === namespace
  })
}

const DESCRIBE_CONFIG: Record<string, DescribeConfig> = {
  pods: {
    items: 'pods',
    formatter: (item, _state, dependencies) => {
      const podEvents = dependencies.listPodEvents?.(
        item.metadata.namespace,
        item.metadata.name
      )
      return describePod(item, podEvents)
    },
    type: 'Pod'
  },
  configmaps: {
    items: 'configMaps',
    formatter: (item) => {
      return describeConfigMap(item)
    },
    type: 'ConfigMap'
  },
  secrets: {
    items: 'secrets',
    formatter: (item) => {
      return describeSecret(item)
    },
    type: 'Secret'
  },
  services: {
    items: 'services',
    formatter: (item, state) => {
      return describeService(item, state)
    },
    type: 'Service'
  },
  endpoints: {
    items: 'endpoints',
    formatter: (item) => {
      return describeEndpoints(item)
    },
    type: 'Endpoints'
  },
  endpointslices: {
    items: 'endpointSlices',
    formatter: (item) => {
      return describeEndpointSlice(item)
    },
    type: 'EndpointSlice'
  },
  deployments: {
    items: 'deployments',
    formatter: (item) => {
      return describeDeployment(item)
    },
    type: 'Deployment'
  },
  replicasets: {
    items: 'replicaSets',
    formatter: (item, state) => {
      return describeReplicaSet(item, state)
    },
    type: 'ReplicaSet'
  },
  ingresses: {
    items: 'ingresses',
    formatter: (item) => {
      return describeIngress(item)
    },
    type: 'Ingress'
  },
  nodes: {
    items: 'nodes',
    formatter: (item, state) => {
      return describeNode(item, state)
    },
    type: 'Node',
    isClusterScoped: true
  },
  persistentvolumes: {
    items: 'persistentVolumes',
    formatter: (item) => {
      return describePersistentVolume(item)
    },
    type: 'PersistentVolume',
    isClusterScoped: true
  },
  persistentvolumeclaims: {
    items: 'persistentVolumeClaims',
    formatter: (item) => {
      return describePersistentVolumeClaim(item)
    },
    type: 'PersistentVolumeClaim'
  },
  leases: {
    items: 'leases',
    formatter: (item) => {
      return describeLease(item)
    },
    type: 'Lease'
  }
} as const

const getNotFoundResourceReference = (resourceType: string): string => {
  if (resourceType === 'deployments') {
    return 'deployments.apps'
  }
  if (resourceType === 'replicasets') {
    return 'replicasets.apps'
  }
  return resourceType
}

/**
 * Handle kubectl describe command
 * Provides detailed multi-line output for pods, configmaps, and secrets
 */
export const handleDescribe = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  dependencies: DescribeDependencies = {}
): ExecutionResult => {
  const state = apiServer.snapshotState()
  const resolvedDependencies: DescribeDependencies = {
    listPodEvents:
      dependencies.listPodEvents ??
      apiServer.podLifecycleEventStore.listPodEvents
  }
  if (!parsed.resource) {
    return error(`error: you must specify the resource type to describe`)
  }

  if (!parsed.name) {
    return error(`error: you must specify the name of the resource to describe`)
  }

  const resourceType = parsed.resource
  const config = DESCRIBE_CONFIG[resourceType]
  if (!config) {
    return error(
      `error: the server doesn't have a resource type "${resourceType}"`
    )
  }

  const namespace = parsed.namespace || 'default'
  const collection = state[config.items] as {
    items: DescribeableResource[]
  }
  const isClusterScoped = config.isClusterScoped === true
  const resource = findDescribeResource(
    collection.items,
    parsed.name,
    namespace,
    isClusterScoped
  )

  if (!resource) {
    const reference = getNotFoundResourceReference(resourceType)
    return error(
      `Error from server (NotFound): ${reference} "${parsed.name}" not found`
    )
  }

  return success(config.formatter(resource, state, resolvedDependencies))
}
