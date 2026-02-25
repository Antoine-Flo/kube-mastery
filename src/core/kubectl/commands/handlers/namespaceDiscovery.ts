import {
  createClusterState,
  type ClusterStateData,
  type ResourceKind
} from '../../../cluster/ClusterState'
import { createEventBus } from '../../../cluster/events/EventBus'

const SYSTEM_DEFAULT_NAMESPACES = [
  'default',
  'kube-system',
  'kube-public',
  'kube-node-lease'
]

const addNamespace = (
  namespaces: Set<string>,
  namespace: string | undefined
): void => {
  if (typeof namespace !== 'string') {
    return
  }
  if (namespace.length === 0) {
    return
  }
  namespaces.add(namespace)
}

/**
 * Build a stable namespace list from namespaced resources.
 * Always includes default and kube-system for parity with cluster bootstrap.
 */
export const collectDiscoveredNamespaces = (
  state: ClusterStateData
): string[] => {
  const namespaces = new Set<string>()
  const namespacedKinds: ResourceKind[] = [
    'Pod',
    'ConfigMap',
    'Secret',
    'Deployment',
    'DaemonSet',
    'ReplicaSet',
    'Service'
  ]
  const explicitNamespaceKinds: ResourceKind[] = ['Namespace']
  const lookupState = createClusterState(createEventBus())
  lookupState.loadState(state)

  for (const namespace of SYSTEM_DEFAULT_NAMESPACES) {
    namespaces.add(namespace)
  }

  for (const kind of namespacedKinds) {
    const resources = lookupState.listByKind(kind)
    for (const resource of resources) {
      addNamespace(
        namespaces,
        (resource as { metadata?: { namespace?: string } }).metadata?.namespace
      )
    }
  }

  for (const kind of explicitNamespaceKinds) {
    const resources = lookupState.listByKind(kind)
    for (const resource of resources) {
      addNamespace(
        namespaces,
        (resource as { metadata?: { name?: string } }).metadata?.name
      )
    }
  }

  return Array.from(namespaces).sort((left, right) => left.localeCompare(right))
}
