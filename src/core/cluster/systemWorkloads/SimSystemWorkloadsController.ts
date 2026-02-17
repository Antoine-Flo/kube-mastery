import type { ClusterNodeRole } from '../clusterConfig'
import type { Pod } from '../ressources/Pod'
import { materializeSimSystemWorkloads } from './SimWorkloadReconcilers'
import {
  createSimSystemWorkloadSpecs,
  type SimSystemWorkloadPolicy
} from './SimWorkloadSpecs'

export type { SimSystemWorkloadPolicy } from './SimWorkloadSpecs'

export interface SimSystemWorkloadsControllerOptions {
  clusterName: string
  nodeRoles: readonly ClusterNodeRole[]
  policy?: SimSystemWorkloadPolicy
  creationTimestamp: string
}

export const createSimSystemWorkloads = (
  options: SimSystemWorkloadsControllerOptions
): Pod[] => {
  const workloadSpecs = createSimSystemWorkloadSpecs({
    clusterName: options.clusterName,
    nodeRoles: options.nodeRoles,
    policy: options.policy
  })
  return materializeSimSystemWorkloads(
    workloadSpecs,
    options.creationTimestamp
  )
}
