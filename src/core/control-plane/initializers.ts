import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { Controller } from './controller-runtime/types'
import { createDaemonSetController } from './controllers/DaemonSetController'
import { createDeploymentController } from './controllers/DeploymentController'
import { createReplicaSetController } from './controllers/ReplicaSetController'
import {
  createSchedulerController,
  type SchedulerControllerOptions
} from './controllers/SchedulerController'
import {
  createPodLifecycleController,
  type PodLifecycleControllerOptions
} from '../kubelet/controllers/PodLifecycleController'

export interface ControlPlaneControllers {
  deploymentController: Controller
  daemonSetController: Controller
  replicaSetController: Controller
  schedulerController: Controller
  podLifecycleController: Controller
}

export interface InitializeControlPlaneOptions {
  deployment?: { resyncIntervalMs?: number }
  daemonSet?: { resyncIntervalMs?: number }
  replicaSet?: { resyncIntervalMs?: number }
  podLifecycle?: PodLifecycleControllerOptions
  scheduler?: SchedulerControllerOptions
}

export const initializeControlPlane = (
  apiServer: ApiServerFacade,
  options: InitializeControlPlaneOptions = {}
): ControlPlaneControllers => {
  const deploymentController = createDeploymentController(
    apiServer,
    options.deployment
  )
  const daemonSetController = createDaemonSetController(
    apiServer,
    options.daemonSet
  )
  const replicaSetController = createReplicaSetController(
    apiServer,
    options.replicaSet
  )
  const schedulerController = createSchedulerController(
    apiServer,
    options.scheduler
  )
  const podLifecycleController = createPodLifecycleController(
    apiServer,
    options.podLifecycle
  )
  return {
    deploymentController,
    daemonSetController,
    replicaSetController,
    schedulerController,
    podLifecycleController
  }
}

export const stopControlPlane = (
  controllers: ControlPlaneControllers | undefined
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
