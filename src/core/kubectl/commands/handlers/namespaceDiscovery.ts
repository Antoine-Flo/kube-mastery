import type { ClusterStateData } from '../../../cluster/ClusterState'

/**
 * Build a stable namespace list from canonical namespace state.
 */
export const collectDiscoveredNamespaces = (
  state: ClusterStateData
): string[] => {
  return [...state.namespaces.items]
    .map((namespace) => namespace.metadata.name)
    .sort((left, right) => left.localeCompare(right))
}
