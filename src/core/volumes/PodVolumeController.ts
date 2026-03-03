import { startPeriodicResync } from '../cluster/controllers/helpers'
import type { ClusterState } from '../cluster/ClusterState'
import type { EventBus } from '../cluster/events/EventBus'
import type { AppEventType } from '../events/AppEvent'
import type { Pod } from '../cluster/ressources/Pod'
import { type PodVolumeReadiness, type VolumeState } from './VolumeState'

interface PodVolumeControllerOptions {
  resyncIntervalMs?: number
}

export interface PodVolumeController {
  start: () => void
  stop: () => void
  initialSync: () => void
  resyncAll: () => void
}

const POD_VOLUME_EVENTS: AppEventType[] = [
  'PodCreated',
  'PodUpdated',
  'PodDeleted',
  'PersistentVolumeCreated',
  'PersistentVolumeUpdated',
  'PersistentVolumeDeleted',
  'PersistentVolumeClaimCreated',
  'PersistentVolumeClaimUpdated',
  'PersistentVolumeClaimDeleted'
]

const evaluatePodVolumeReadiness = (
  pod: Pod,
  clusterState: ClusterState,
  volumeState: VolumeState
): PodVolumeReadiness => {
  const volumes = pod.spec.volumes ?? []
  for (const volume of volumes) {
    if (volume.source.type === 'emptyDir') {
      continue
    }
    if (volume.source.type === 'configMap') {
      continue
    }
    if (volume.source.type === 'secret') {
      continue
    }
    if (volume.source.type === 'hostPath') {
      if (pod.spec.nodeName == null || pod.spec.nodeName.length === 0) {
        return {
          ready: false,
          reason: 'VolumeHostPathNodeUnavailable'
        }
      }
      volumeState.reserveHostPath(pod.spec.nodeName, volume.source.path)
      continue
    }
    if (volume.source.type === 'persistentVolumeClaim') {
      const persistentVolumeClaimResult =
        clusterState.findPersistentVolumeClaim(
          volume.source.claimName,
          pod.metadata.namespace
        )
      if (
        !persistentVolumeClaimResult.ok ||
        persistentVolumeClaimResult.value == null
      ) {
        return {
          ready: false,
          reason: 'PersistentVolumeClaimNotFound'
        }
      }
      const persistentVolumeClaim = persistentVolumeClaimResult.value
      const boundVolumeName =
        persistentVolumeClaim.spec.volumeName ??
        volumeState.getBoundVolumeForClaim(
          pod.metadata.namespace,
          volume.source.claimName
        )
      if (
        persistentVolumeClaim.status.phase !== 'Bound' ||
        boundVolumeName == null ||
        boundVolumeName.length === 0
      ) {
        return {
          ready: false,
          reason: 'PersistentVolumeClaimPending'
        }
      }
      const persistentVolumeResult =
        clusterState.findPersistentVolume(boundVolumeName)
      if (!persistentVolumeResult.ok || persistentVolumeResult.value == null) {
        return {
          ready: false,
          reason: 'PersistentVolumeNotFound'
        }
      }
      if (persistentVolumeResult.value.status.phase !== 'Bound') {
        return {
          ready: false,
          reason: 'PersistentVolumeNotBound'
        }
      }
    }
  }

  return { ready: true }
}

export const createPodVolumeController = (
  eventBus: EventBus,
  clusterState: ClusterState,
  volumeState: VolumeState,
  options: PodVolumeControllerOptions = {}
): PodVolumeController => {
  let started = false
  let unsubscribeEvents: (() => void) | undefined
  let stopResync: (() => void) | undefined

  const reconcilePods = (): void => {
    const pods = clusterState.getPods()
    for (const pod of pods) {
      const readiness = evaluatePodVolumeReadiness(
        pod,
        clusterState,
        volumeState
      )
      volumeState.setPodReadiness(
        pod.metadata.namespace,
        pod.metadata.name,
        readiness
      )
    }
  }

  const onEvent = (event: { type: AppEventType; payload?: unknown }): void => {
    if (event.type === 'PodDeleted') {
      const deletedPodEvent = event as {
        payload: { deletedPod: Pod }
      }
      volumeState.removePodReadiness(
        deletedPodEvent.payload.deletedPod.metadata.namespace,
        deletedPodEvent.payload.deletedPod.metadata.name
      )
      reconcilePods()
      return
    }
    if (!POD_VOLUME_EVENTS.includes(event.type)) {
      return
    }
    reconcilePods()
  }

  const initialSync = (): void => {
    reconcilePods()
  }

  const resyncAll = (): void => {
    reconcilePods()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
    initialSync()
    const unsubscribers: Array<() => void> = []
    for (const eventType of POD_VOLUME_EVENTS) {
      const unsubscribe = eventBus.subscribe(
        eventType,
        onEvent as (event: unknown) => void
      )
      unsubscribers.push(unsubscribe)
    }
    unsubscribeEvents = () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
    }
    stopResync = startPeriodicResync(options.resyncIntervalMs, resyncAll)
  }

  const stop = (): void => {
    if (!started) {
      return
    }
    started = false
    if (unsubscribeEvents != null) {
      unsubscribeEvents()
      unsubscribeEvents = undefined
    }
    if (stopResync != null) {
      stopResync()
      stopResync = undefined
    }
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll
  }
}
