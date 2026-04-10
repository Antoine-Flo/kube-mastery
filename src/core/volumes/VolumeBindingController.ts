import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { Pod } from '../cluster/ressources/Pod'
import {
  createWorkQueue,
  type WorkQueue
} from '../control-plane/controller-runtime/WorkQueue'
import { startPeriodicResync } from '../control-plane/controller-runtime/helpers'
import type { AppEventType } from '../events/AppEvent'
import {
  createVolumeBindingPolicy,
  type VolumeBindingPolicy
} from './VolumeBindingPolicy'
import { type VolumeState } from './VolumeState'
import { hasWaitForFirstConsumerBindingMode } from './pvcBindingMode'
import {
  enqueuePendingClaimsMatchingVolume,
  makeClaimKey,
  reconcileClaimByKey,
  reconcileVolumeByKey
} from './reconcile/volumeBindingReconciler'

interface VolumeBindingControllerOptions {
  resyncIntervalMs?: number
  policy?: VolumeBindingPolicy
}

export interface VolumeBindingController {
  start: () => void
  stop: () => void
  initialSync: () => void
  resyncAll: () => void
}

const VOLUME_BINDING_EVENTS: AppEventType[] = [
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

export const createVolumeBindingController = (
  apiServer: ApiServerFacade,
  volumeState: VolumeState,
  options: VolumeBindingControllerOptions = {}
): VolumeBindingController => {
  const eventBus = apiServer.getEventBus()
  const bindingPolicy = options.policy ?? createVolumeBindingPolicy()
  let started = false
  let unsubscribeEvents: (() => void) | undefined
  let stopResync: (() => void) | undefined
  const claimQueue: WorkQueue = createWorkQueue({ processDelay: 0 })
  const volumeQueue: WorkQueue = createWorkQueue({ processDelay: 0 })

  const enqueueClaimByKey = (claimKey: string): void => {
    claimQueue.add(claimKey)
  }

  const enqueueClaim = (namespace: string, name: string): void => {
    enqueueClaimByKey(makeClaimKey(namespace, name))
  }

  const enqueueVolume = (name: string): void => {
    volumeQueue.add(name)
  }

  const reconcileAll = (): void => {
    for (const persistentVolumeClaim of apiServer.listResources(
      'PersistentVolumeClaim'
    )) {
      enqueueClaim(
        persistentVolumeClaim.metadata.namespace,
        persistentVolumeClaim.metadata.name
      )
    }
    for (const persistentVolume of apiServer.listResources('PersistentVolume')) {
      enqueueVolume(persistentVolume.metadata.name)
    }
  }

  const onEvent = (event: { type: AppEventType; payload?: unknown }): void => {
    if (!VOLUME_BINDING_EVENTS.includes(event.type)) {
      return
    }

    if (event.type === 'PersistentVolumeCreated') {
      const payload = event.payload as { persistentVolume?: { metadata: { name: string } } }
      if (payload.persistentVolume != null) {
        enqueueVolume(payload.persistentVolume.metadata.name)
        const persistentVolumeResult = apiServer.findResource(
          'PersistentVolume',
          payload.persistentVolume.metadata.name
        )
        if (persistentVolumeResult.ok && persistentVolumeResult.value != null) {
          enqueuePendingClaimsMatchingVolume(persistentVolumeResult.value, {
            apiServer,
            enqueueClaim
          })
        }
      }
      return
    }
    if (event.type === 'PersistentVolumeUpdated') {
      const payload = event.payload as { persistentVolume?: { metadata: { name: string } } }
      if (payload.persistentVolume != null) {
        enqueueVolume(payload.persistentVolume.metadata.name)
        const persistentVolumeResult = apiServer.findResource(
          'PersistentVolume',
          payload.persistentVolume.metadata.name
        )
        if (persistentVolumeResult.ok && persistentVolumeResult.value != null) {
          enqueuePendingClaimsMatchingVolume(persistentVolumeResult.value, {
            apiServer,
            enqueueClaim
          })
        }
      }
      return
    }
    if (event.type === 'PersistentVolumeDeleted') {
      const payload = event.payload as {
        deletedPersistentVolume?: { spec?: { claimRef?: { namespace: string; name: string } } }
      }
      const claimRef = payload.deletedPersistentVolume?.spec?.claimRef
      if (claimRef != null) {
        enqueueClaim(claimRef.namespace, claimRef.name)
      }
      return
    }
    if (event.type === 'PersistentVolumeClaimCreated') {
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
    if (event.type === 'PersistentVolumeClaimUpdated') {
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
    if (event.type === 'PersistentVolumeClaimDeleted') {
      const payload = event.payload as {
        deletedPersistentVolumeClaim?: { metadata: { namespace: string; name: string }; spec: { volumeName?: string } }
      }
      if (payload.deletedPersistentVolumeClaim != null) {
        const claimNamespace = payload.deletedPersistentVolumeClaim.metadata.namespace
        const claimName = payload.deletedPersistentVolumeClaim.metadata.name
        volumeState.unbindClaim(claimNamespace, claimName)
        const volumeName = payload.deletedPersistentVolumeClaim.spec.volumeName
        if (volumeName != null && volumeName.length > 0) {
          enqueueVolume(volumeName)
        }
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
        for (const claim of apiServer.listResources('PersistentVolumeClaim')) {
          const waitForFirstConsumer = hasWaitForFirstConsumerBindingMode(
            apiServer,
            claim.spec.storageClassName
          )
          if (!waitForFirstConsumer) {
            continue
          }
          enqueueClaim(claim.metadata.namespace, claim.metadata.name)
        }
        return
      }
      const podVolumes = pod.spec.volumes ?? []
      for (const volume of podVolumes) {
        if (volume.source.type !== 'persistentVolumeClaim') {
          continue
        }
        const claimName = volume.source.claimName
        const claimResult = apiServer.findResource(
          'PersistentVolumeClaim',
          claimName,
          pod.metadata.namespace
        )
        if (!claimResult.ok || claimResult.value == null) {
          continue
        }
        const waitForFirstConsumer = hasWaitForFirstConsumerBindingMode(
          apiServer,
          claimResult.value.spec.storageClassName
        )
        if (!waitForFirstConsumer) {
          continue
        }
        enqueueClaim(pod.metadata.namespace, claimName)
      }
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
      reconcileClaimByKey(claimKey, {
        apiServer,
        volumeState,
        bindingPolicy,
        enqueueClaim,
        enqueueVolume
      })
    })
    volumeQueue.start((volumeName) => {
      reconcileVolumeByKey(volumeName, {
        apiServer,
        volumeState,
        bindingPolicy,
        enqueueClaim,
        enqueueVolume
      })
    })
    initialSync()
    const unsubscribers: Array<() => void> = []
    for (const eventType of VOLUME_BINDING_EVENTS) {
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
    volumeQueue.stop()
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll
  }
}
