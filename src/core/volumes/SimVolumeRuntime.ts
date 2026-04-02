import type { ApiServerFacade } from '../api/ApiServerFacade'
import {
  createPodVolumeController,
  type PodVolumeController
} from './PodVolumeController'
import {
  createVolumeBindingController,
  type VolumeBindingController
} from './VolumeBindingController'
import {
  createVolumeProvisioningController,
  type VolumeProvisioningController
} from './VolumeProvisioningController'
import { createVolumeState, type VolumeState } from './VolumeState'

export interface SimVolumeRuntime {
  state: VolumeState
  volumeProvisioningController: VolumeProvisioningController
  volumeBindingController: VolumeBindingController
  podVolumeController: PodVolumeController
}

export const initializeSimVolumeRuntime = (
  apiServer: ApiServerFacade
): SimVolumeRuntime => {
  const state = createVolumeState()
  const volumeProvisioningController =
    createVolumeProvisioningController(apiServer)
  const volumeBindingController = createVolumeBindingController(
    apiServer,
    state
  )
  const podVolumeController = createPodVolumeController(apiServer, state)
  volumeProvisioningController.start()
  volumeBindingController.start()
  podVolumeController.start()
  return {
    state,
    volumeProvisioningController,
    volumeBindingController,
    podVolumeController
  }
}
