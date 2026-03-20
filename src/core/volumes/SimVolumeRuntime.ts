import type { ApiServerFacade } from '../api/ApiServerFacade'
import {
  createPodVolumeController,
  type PodVolumeController
} from './PodVolumeController'
import {
  createVolumeBindingController,
  type VolumeBindingController
} from './VolumeBindingController'
import { createVolumeState, type VolumeState } from './VolumeState'

export interface SimVolumeRuntime {
  state: VolumeState
  volumeBindingController: VolumeBindingController
  podVolumeController: PodVolumeController
}

export const initializeSimVolumeRuntime = (
  apiServer: ApiServerFacade
): SimVolumeRuntime => {
  const state = createVolumeState()
  const volumeBindingController = createVolumeBindingController(
    apiServer,
    state
  )
  const podVolumeController = createPodVolumeController(apiServer, state)
  volumeBindingController.start()
  podVolumeController.start()
  return {
    state,
    volumeBindingController,
    podVolumeController
  }
}
