import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import {
  DESCRIBE_CONFIG,
  type DescribeResourceConfig
} from '../../describe/registry'
import type { DescribeDependencies } from '../../describe/interface'
import { toPluralResourceKindReference } from '../resourceCatalog'
import { applyFilters, noResourcesMessage } from './internal/get/filters'
import type { ParsedCommand } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL DESCRIBE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Resource map mirrors refs/k8s/kubectl/pkg/describe describerMap (see registry.ts)

interface DescribeableResource {
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
}

const sortDescribeResources = (
  resources: DescribeableResource[]
): DescribeableResource[] => {
  return [...resources].sort((left, right) => {
    const namespaceDiff = left.metadata.namespace.localeCompare(
      right.metadata.namespace
    )
    if (namespaceDiff !== 0) {
      return namespaceDiff
    }
    return left.metadata.name.localeCompare(right.metadata.name)
  })
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
      apiServer.podLifecycleEventStore.listPodEvents,
    listDeploymentEvents:
      dependencies.listDeploymentEvents ??
      apiServer.deploymentLifecycleEventStore.listDeploymentEvents,
    listPersistentVolumeClaimEvents:
      dependencies.listPersistentVolumeClaimEvents ??
      apiServer.persistentVolumeClaimLifecycleEventStore
        .listPersistentVolumeClaimEvents
  }
  if (!parsed.resource) {
    return error(`error: you must specify the resource type to describe`)
  }

  const resourceType = parsed.resource
  const config: DescribeResourceConfig | undefined =
    DESCRIBE_CONFIG[resourceType]
  if (!config) {
    return error(
      `error: the server doesn't have a resource type "${resourceType}"`
    )
  }
  const canDescribeWithoutName = config.allowsDescribeWithoutName === true
  if (!parsed.name && !parsed.selector && !canDescribeWithoutName) {
    return error(`error: you must specify the name of the resource to describe`)
  }

  const allNamespacesFlag =
    parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
  const effectiveNamespace = parsed.namespace ?? 'default'
  const filterNamespace = allNamespacesFlag ? undefined : effectiveNamespace
  const collection = state[config.items] as {
    items: DescribeableResource[]
  }
  const isClusterScoped = config.isClusterScoped === true
  const filteredResources = applyFilters(
    collection.items,
    filterNamespace,
    parsed.selector,
    isClusterScoped,
    parsed.name
  )
  const resourcesToDescribe = sortDescribeResources(filteredResources)

  if (parsed.name && resourcesToDescribe.length === 0) {
    const reference = toPluralResourceKindReference(resourceType)
    return error(
      `Error from server (NotFound): ${reference} "${parsed.name}" not found`
    )
  }
  if (!parsed.name && resourcesToDescribe.length === 0) {
    return success(
      noResourcesMessage(
        allNamespacesFlag ? undefined : effectiveNamespace,
        isClusterScoped
      )
    )
  }

  const describeOutput = resourcesToDescribe
    .map((resource) => {
      return config.formatter(resource, state, resolvedDependencies)
    })
    .join('\n\n')
  return success(describeOutput)
}
