import { startPeriodicResync } from '../control-plane/controller-runtime/helpers'
import {
  createWorkQueue,
  type WorkQueue
} from '../control-plane/controller-runtime/WorkQueue'
import type { ApiServerFacade } from '../api/ApiServerFacade'
import { createPodVolumeLifecycleEvent } from '../cluster/events/types'
import type { AppEventType } from '../events/AppEvent'
import type { Pod } from '../cluster/ressources/Pod'
import { type VolumeState } from './VolumeState'
import {
  makePodVolumeKey,
  reconcilePodVolumeByKey
} from './reconcile/podVolumeReconciler'

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

export const createPodVolumeController = (
  apiServer: ApiServerFacade,
  volumeState: VolumeState,
  options: PodVolumeControllerOptions = {}
): PodVolumeController => {
  const eventBus = apiServer.getEventBus()
  let started = false
  let unsubscribeEvents: (() => void) | undefined
  let stopResync: (() => void) | undefined
  const podQueue: WorkQueue = createWorkQueue({ processDelay: 0 })

  const enqueuePod = (namespace: string, name: string): void => {
    podQueue.add(makePodVolumeKey(namespace, name))
  }

  const enqueueAllPods = (): void => {
    for (const pod of apiServer.listResources('Pod')) {
      enqueuePod(pod.metadata.namespace, pod.metadata.name)
    }
  }

  const onEvent = (event: { type: AppEventType; payload?: unknown }): void => {
    if (event.type === 'PodDeleted') {
      const deletedPodEvent = event as {
        payload: { deletedPod: Pod }
      }
      const deletedPod = deletedPodEvent.payload.deletedPod
      volumeState.removePodReadiness(
        deletedPod.metadata.namespace,
        deletedPod.metadata.name
      )
      return
    }
    if (
      event.type === 'PodCreated' ||
      event.type === 'PodUpdated'
    ) {
      const createdOrUpdatedPodEvent = event as {
        payload: { pod: Pod }
      }
      const pod = createdOrUpdatedPodEvent.payload.pod
      enqueuePod(pod.metadata.namespace, pod.metadata.name)
      return
    }
    if (
      event.type === 'PersistentVolumeCreated' ||
      event.type === 'PersistentVolumeUpdated' ||
      event.type === 'PersistentVolumeDeleted' ||
      event.type === 'PersistentVolumeClaimCreated' ||
      event.type === 'PersistentVolumeClaimUpdated' ||
      event.type === 'PersistentVolumeClaimDeleted'
    ) {
      enqueueAllPods()
      return
    }
    if (!POD_VOLUME_EVENTS.includes(event.type)) {
      return
    }
  }

  const initialSync = (): void => {
    enqueueAllPods()
  }

  const resyncAll = (): void => {
    enqueueAllPods()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
    podQueue.start((podKey) => {
      const reconcileResult = reconcilePodVolumeByKey(podKey, {
        apiServer,
        volumeState
      })
      if (reconcileResult.lifecycleEvent == null) {
        return
      }
      apiServer.emitEvent(
        createPodVolumeLifecycleEvent(
          reconcileResult.lifecycleEvent.namespace,
          reconcileResult.lifecycleEvent.name,
          reconcileResult.lifecycleEvent.reason,
          reconcileResult.lifecycleEvent.message,
          reconcileResult.lifecycleEvent.eventType,
          reconcileResult.lifecycleEvent.source
        )
      )
    })
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
    podQueue.stop()
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll
  }
}
