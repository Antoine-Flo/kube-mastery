// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PODS (SIM WORKLOADS)
// ═══════════════════════════════════════════════════════════════════════════
// Delegates kube-system workload creation to SimSystemWorkloadsController.

import {
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from './clusterConfig'
import type { Pod } from './ressources/Pod'
import {
  createSimSystemWorkloads,
  type SimSystemWorkloadPolicy
} from './systemWorkloads/SimSystemWorkloadsController'

export interface GetSystemPodsOptions {
  clusterName: string
  nodeRoles?: readonly ClusterNodeRole[]
  policy?: SimSystemWorkloadPolicy
  /** Optional clock for creationTimestamp (e.g. for tests/conformance). Default: now */
  clock?: () => string
}

/**
 * Returns a list of system pods (kube-system, local-path-storage) to be
 * added to the cluster state after loading a seed. Aligns with what kind
 * installs so that get pods -A output is comparable.
 * Uses dynamic creationTimestamp so formatAge() shows realistic age (0s, 5s, etc.).
 * Pod names for ReplicaSet-style components use Kind-like format (prefix-hash-suffix).
 */
export const getSystemPods = (options?: GetSystemPodsOptions): Pod[] => {
  const clusterName = options?.clusterName ?? 'conformance'
  const nodeRoles = options?.nodeRoles ?? DEFAULT_CLUSTER_NODE_ROLES
  const creationTimestamp =
    options?.clock != null ? options.clock() : new Date().toISOString()
  return createSimSystemWorkloads({
    clusterName,
    nodeRoles,
    policy: options?.policy,
    creationTimestamp
  })
}
