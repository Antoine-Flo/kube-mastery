import { startPeriodicResync } from '../control-plane/controller-runtime/helpers'
import {
  createWorkQueue,
  type WorkQueue
} from '../control-plane/controller-runtime/WorkQueue'
import type { ApiServerFacade } from '../api/ApiServerFacade'
import { createPersistentVolumeClaimLifecycleEvent } from '../cluster/events/types'
import type { Pod } from '../cluster/ressources/Pod'
import type { AppEventType } from '../events/AppEvent'
import {
  createVolumeBindingPolicy,
  type VolumeBindingPolicy
} from './VolumeBindingPolicy'
import {
  makeProvisioningClaimKey,
  reconcileProvisioningClaimByKey
} from './reconcile/volumeProvisioningReconciler'

interface VolumeProvisioningControllerOptions {
  resyncIntervalMs?: number
  policy?: VolumeBindingPolicy
}

export interface VolumeProvisioningController {
  start: () => void
  stop: () => void
  initialSync: () => void
  resyncAll: () => void
}

const PROVISIONING_EVENTS: AppEventType[] = [
  'PodCreated',
  'PodUpdated',
  'PodDeleted',
  'PersistentVolumeCreated',
  'PersistentVolumeUpdated',
  'PersistentVolumeDeleted',
  'PersistentVolumeClaimCreated',
  'PersistentVolumeClaimUpdated',
  'PersistentVolumeClaimDeleted',
  'StorageClassCreated',
  'StorageClassUpdated',
  'StorageClassDeleted'
]

export const createVolumeProvisioningController = (
  apiServer: ApiServerFacade,
  options: VolumeProvisioningControllerOptions = {}
): VolumeProvisioningController => {
  const eventBus = apiServer.getEventBus()
  const bindingPolicy = options.policy ?? createVolumeBindingPolicy()
  let started = false
  let unsubscribeEvents: (() => void) | undefined
  let stopResync: (() => void) | undefined
  const claimQueue: WorkQueue = createWorkQueue({ processDelay: 0 })

  const enqueueClaim = (namespace: string, name: string): void => {
    claimQueue.add(makeProvisioningClaimKey(namespace, name))
  }

  const enqueuePendingClaims = (): void => {
    for (const claim of apiServer.listResources('PersistentVolumeClaim')) {
      if (claim.status.phase !== 'Pending') {
        continue
      }
      enqueueClaim(claim.metadata.namespace, claim.metadata.name)
    }
  }

  const reconcileAll = (): void => {
    for (const claim of apiServer.listResources('PersistentVolumeClaim')) {
      enqueueClaim(claim.metadata.namespace, claim.metadata.name)
    }
  }

  const onEvent = (event: { type: AppEventType; payload?: unknown }): void => {
    if (!PROVISIONING_EVENTS.includes(event.type)) {
      return
    }
    if (
      event.type === 'PersistentVolumeClaimCreated' ||
      event.type === 'PersistentVolumeClaimUpdated'
    ) {
      const payload = event.payload as {
        persistentVolumeClaim?: { metadata: { namespace: string; name: string } }
      }
      if (payload.persistentVolumeClaim != null) {
        enqueueClaim(
          payload.persistentVolumeClaim.metadata.namespace,
          payload.persistentVolumeClaim.metadata.name
        )
      }
      return
    }

    if (
      event.type === 'PodCreated' ||
      event.type === 'PodUpdated' ||
      event.type === 'PodDeleted'
    ) {
      const payload = event.payload as {
        pod?: Pod
        deletedPod?: Pod
      }
      const pod = payload.pod ?? payload.deletedPod
      if (pod == null) {
        enqueuePendingClaims()
        return
      }
      const podVolumes = pod.spec.volumes ?? []
      for (const volume of podVolumes) {
        if (volume.source.type !== 'persistentVolumeClaim') {
          continue
        }
        enqueueClaim(pod.metadata.namespace, volume.source.claimName)
      }
      return
    }

    if (
      event.type === 'StorageClassCreated' ||
      event.type === 'StorageClassUpdated' ||
      event.type === 'StorageClassDeleted' ||
      event.type === 'PersistentVolumeCreated' ||
      event.type === 'PersistentVolumeUpdated' ||
      event.type === 'PersistentVolumeDeleted'
    ) {
      enqueuePendingClaims()
      return
    }
  }

  const initialSync = (): void => {
    reconcileAll()
  }

  const resyncAll = (): void => {
    reconcileAll()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
    claimQueue.start((claimKey) => {
      const reconcileResult = reconcileProvisioningClaimByKey(claimKey, {
        apiServer,
        bindingPolicy
      })
      if (reconcileResult.lifecycleEvent == null) {
        return
      }
      apiServer.emitEvent(
        createPersistentVolumeClaimLifecycleEvent(
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
    for (const eventType of PROVISIONING_EVENTS) {
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
    claimQueue.stop()
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll
  }
}
