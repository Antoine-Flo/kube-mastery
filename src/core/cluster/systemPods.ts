// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM WORKLOADS
// ═══════════════════════════════════════════════════════════════════════════
// Delegates kube-system workload creation to SimSystemWorkloadsController.

import {
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from './clusterConfig'
import type { DaemonSet } from './ressources/DaemonSet'
import type { Deployment } from './ressources/Deployment'
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
 * Static pods are returned directly; controller-managed resources are returned
 * as top-level objects to be reconciled by controllers.
 */
export interface SystemWorkloads {
  staticPods: Pod[]
  deployments: Deployment[]
  daemonSets: DaemonSet[]
}

export const getSystemWorkloads = (
  options?: GetSystemPodsOptions
): SystemWorkloads => {
  const clusterName = options?.clusterName ?? 'conformance'
  const nodeRoles = options?.nodeRoles ?? DEFAULT_CLUSTER_NODE_ROLES
  const creationTimestamp =
    options?.clock != null ? options.clock() : new Date().toISOString()
  const workloads = createSimSystemWorkloads({
    clusterName,
    nodeRoles,
    policy: options?.policy,
    creationTimestamp
  })
  return {
    staticPods: workloads.staticPods,
    deployments: workloads.deployments,
    daemonSets: workloads.daemonSets
  }
}

export const getSystemPods = (options?: GetSystemPodsOptions): Pod[] => {
  return getSystemWorkloads(options).staticPods
}
