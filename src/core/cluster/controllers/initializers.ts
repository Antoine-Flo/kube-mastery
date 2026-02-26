import type { ClusterState } from '../ClusterState'
import type { EventBus } from '../events/EventBus'
import { createDaemonSetController } from './DaemonSetController'
import { createDeploymentController } from './DeploymentController'
import {
  createPodLifecycleController,
  type PodLifecycleControllerOptions
} from './PodLifecycleController'
import { createReplicaSetController } from './ReplicaSetController'
import {
  createSchedulerController,
  type SchedulerControllerOptions
} from './SchedulerController'
import type { Controller, ControllerState } from './types'

export interface RuntimeControllers {
  deploymentController: Controller
  daemonSetController: Controller
  replicaSetController: Controller
  podLifecycleController: Controller
  schedulerController: Controller
}

export interface InitializeControllersOptions {
  deployment?: { resyncIntervalMs?: number }
  daemonSet?: { resyncIntervalMs?: number }
  replicaSet?: { resyncIntervalMs?: number }
  podLifecycle?: PodLifecycleControllerOptions
  scheduler?: SchedulerControllerOptions
}

const createControllerStateAccessor = (
  clusterState: ClusterState
): (() => ControllerState) => {
  return () => ({
    getDeployments: clusterState.getDeployments,
    getDaemonSets: clusterState.getDaemonSets,
    getReplicaSets: clusterState.getReplicaSets,
    getPods: clusterState.getPods,
    findDeployment: clusterState.findDeployment,
    findDaemonSet: clusterState.findDaemonSet,
    findReplicaSet: clusterState.findReplicaSet,
    findPod: clusterState.findPod,
    getNodes: clusterState.getNodes,
    getPersistentVolumes: clusterState.getPersistentVolumes,
    findPersistentVolume: clusterState.findPersistentVolume,
    getPersistentVolumeClaims: clusterState.getPersistentVolumeClaims,
    findPersistentVolumeClaim: clusterState.findPersistentVolumeClaim
  })
}

export const initializeControllers = (
  eventBus: EventBus,
  clusterState: ClusterState,
  options: InitializeControllersOptions = {}
): RuntimeControllers => {
  const getState = createControllerStateAccessor(clusterState)
  const deploymentController = createDeploymentController(
    eventBus,
    getState,
    options.deployment
  )
  const daemonSetController = createDaemonSetController(
    eventBus,
    getState,
    options.daemonSet
  )
  const replicaSetController = createReplicaSetController(
    eventBus,
    getState,
    options.replicaSet
  )
  const podLifecycleController = createPodLifecycleController(
    eventBus,
    getState,
    options.podLifecycle
  )
  const schedulerController = createSchedulerController(
    eventBus,
    getState,
    options.scheduler
  )
  return {
    deploymentController,
    daemonSetController,
    replicaSetController,
    podLifecycleController,
    schedulerController
  }
}

export const stopRuntimeControllers = (
  controllers: RuntimeControllers | undefined
): void => {
  if (controllers == null) {
    return
  }
  controllers.deploymentController.stop()
  controllers.daemonSetController.stop()
  controllers.replicaSetController.stop()
  controllers.schedulerController.stop()
  controllers.podLifecycleController.stop()
}
