import type { ClusterStateData } from '../../../cluster/ClusterState'

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

  for (const namespace of SYSTEM_DEFAULT_NAMESPACES) {
    namespaces.add(namespace)
  }

  for (const pod of state.pods.items) {
    addNamespace(namespaces, pod.metadata.namespace)
  }
  for (const configMap of state.configMaps.items) {
    addNamespace(namespaces, configMap.metadata.namespace)
  }
  for (const secret of state.secrets.items) {
    addNamespace(namespaces, secret.metadata.namespace)
  }
  for (const deployment of state.deployments.items) {
    addNamespace(namespaces, deployment.metadata.namespace)
  }
  for (const replicaSet of state.replicaSets.items) {
    addNamespace(namespaces, replicaSet.metadata.namespace)
  }
  for (const service of state.services.items) {
    addNamespace(namespaces, service.metadata.namespace)
  }

  return Array.from(namespaces).sort((left, right) => left.localeCompare(right))
}
