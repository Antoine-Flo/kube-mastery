import type { ClusterState } from '../ClusterState'
import type { EventBus } from '../events/EventBus'
import {
  createScheduler,
  type Scheduler,
  type SchedulerOptions
} from '../scheduler'
import { createDeploymentController } from './DeploymentController'
import { createReplicaSetController } from './ReplicaSetController'
import type { ControllerState } from './types'

const createControllerStateAccessor = (
  clusterState: ClusterState
): (() => ControllerState) => {
  return () => ({
    getDeployments: clusterState.getDeployments,
    getReplicaSets: clusterState.getReplicaSets,
    getPods: clusterState.getPods,
    findDeployment: clusterState.findDeployment,
    findReplicaSet: clusterState.findReplicaSet,
    findPod: clusterState.findPod,
    getNodes: clusterState.getNodes
  })
}

export const initializeControllers = (
  eventBus: EventBus,
  clusterState: ClusterState
) => {
  const getState = createControllerStateAccessor(clusterState)
  const deploymentController = createDeploymentController(eventBus, getState)
  const replicaSetController = createReplicaSetController(eventBus, getState)
  return {
    deploymentController,
    replicaSetController
  }
}

export const initializeScheduler = (
  eventBus: EventBus,
  clusterState: ClusterState,
  options: SchedulerOptions = {}
): Scheduler => {
  const getState = createControllerStateAccessor(clusterState)
  const scheduler = createScheduler(eventBus, getState, options)
  scheduler.start()
  return scheduler
}
