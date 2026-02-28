import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import {
  describeConfigMap,
  describeDeployment,
  describeIngress,
  describeNode,
  describePersistentVolume,
  describePersistentVolumeClaim,
  describePod,
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
  formatter: (item: any, state: ClusterStateData) => string
  type: string
  isClusterScoped?: boolean
}

interface DescribeableResource {
  metadata: {
    name: string
    namespace: string
  }
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
    formatter: (item) => {
      return describePod(item)
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
  deployments: {
    items: 'deployments',
    formatter: (item) => {
      return describeDeployment(item)
    },
    type: 'Deployment'
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
  }
} as const

const getNotFoundResourceReference = (resourceType: string): string => {
  if (resourceType === 'deployments') {
    return 'deployments.apps'
  }
  return resourceType
}

/**
 * Handle kubectl describe command
 * Provides detailed multi-line output for pods, configmaps, and secrets
 */
export const handleDescribe = (
  state: ClusterStateData,
  parsed: ParsedCommand
): ExecutionResult => {
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

  return success(config.formatter(resource, state))
}
