import type { ClusterNodeRole } from '../clusterConfig'
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

export type SimSystemWorkloads = ReturnType<
  typeof materializeSimSystemWorkloads
>

export const createSimSystemWorkloads = (
  options: SimSystemWorkloadsControllerOptions
): SimSystemWorkloads => {
  const workloadSpecs = createSimSystemWorkloadSpecs({
    clusterName: options.clusterName,
    nodeRoles: options.nodeRoles,
    policy: options.policy
  })
  return materializeSimSystemWorkloads(workloadSpecs, options.creationTimestamp)
}
