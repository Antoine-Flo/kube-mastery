import type { ClusterState } from '../cluster/ClusterState'
import type { EventBus } from '../cluster/events/EventBus'
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
  eventBus: EventBus,
  clusterState: ClusterState
): SimVolumeRuntime => {
  const state = createVolumeState()
  const volumeBindingController = createVolumeBindingController(
    eventBus,
    clusterState,
    state
  )
  const podVolumeController = createPodVolumeController(
    eventBus,
    clusterState,
    state
  )
  volumeBindingController.start()
  podVolumeController.start()
  return {
    state,
    volumeBindingController,
    podVolumeController
  }
}
