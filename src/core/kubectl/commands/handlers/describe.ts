import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import {
  describeConfigMap,
  describeDeployment,
  describePod,
  describeSecret
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
  formatter: (item: any) => string
  type: string
}

const DESCRIBE_CONFIG: Record<string, DescribeConfig> = {
  pods: {
    items: 'pods',
    formatter: describePod,
    type: 'Pod'
  },
  configmaps: {
    items: 'configMaps',
    formatter: describeConfigMap,
    type: 'ConfigMap'
  },
  secrets: {
    items: 'secrets',
    formatter: describeSecret,
    type: 'Secret'
  },
  deployments: {
    items: 'deployments',
    formatter: describeDeployment,
    type: 'Deployment'
  }
} as const

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
    items: Array<{ metadata: { name: string; namespace: string } }>
  }
  const resource = collection.items.find(
    (item) =>
      item.metadata.name === parsed.name &&
      item.metadata.namespace === namespace
  )

  if (!resource) {
    return error(
      `Error from server (NotFound): ${resourceType} "${parsed.name}" not found`
    )
  }

  return success(config.formatter(resource))
}
