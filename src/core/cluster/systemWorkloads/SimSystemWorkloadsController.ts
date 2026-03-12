import type { ClusterNodeRole } from '../clusterConfig'
import { materializeSimSystemWorkloads } from './SimWorkloadReconcilers'
import { createSimSystemWorkloadSpecs } from './SimWorkloadSpecs'

export interface SimSystemWorkloadsControllerOptions {
  clusterName: string
  nodeRoles: readonly ClusterNodeRole[]
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
    nodeRoles: options.nodeRoles
  })
  return materializeSimSystemWorkloads(workloadSpecs, options.creationTimestamp)
}
