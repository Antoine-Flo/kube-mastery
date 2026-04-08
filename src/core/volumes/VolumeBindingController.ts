import { startPeriodicResync } from '../control-plane/controller-runtime/helpers'
import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { AppEventType } from '../events/AppEvent'
import { releasePersistentVolumeBacking } from './runtime'
import { type VolumeState } from './VolumeState'
import {
  createVolumeBindingPolicy,
  type VolumeBindingPolicy
} from './VolumeBindingPolicy'
import {
  hasPodConsumerForClaim,
  hasWaitForFirstConsumerBindingMode
} from './pvcBindingMode'

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

  const reconcileVolumeClaims = (): void => {
    const persistentVolumes = [...apiServer.listResources('PersistentVolume')]
    const persistentVolumeClaims = [
      ...apiServer.listResources('PersistentVolumeClaim')
    ]
    const assignedVolumeNames = new Set<string>()
    const claimByKey = new Map<
      string,
      (typeof persistentVolumeClaims)[number]
    >()
    for (const persistentVolumeClaim of persistentVolumeClaims) {
      const key = `${persistentVolumeClaim.metadata.namespace}/${persistentVolumeClaim.metadata.name}`
      claimByKey.set(key, persistentVolumeClaim)
    }

    for (const persistentVolume of persistentVolumes) {
      const claimRef = persistentVolume.spec.claimRef
      if (claimRef == null) {
        continue
      }

      assignedVolumeNames.add(persistentVolume.metadata.name)

      const claimKey = `${claimRef.namespace}/${claimRef.name}`
      if (claimByKey.has(claimKey)) {
        continue
      }
      if (persistentVolume.spec.persistentVolumeReclaimPolicy === 'Delete') {
        apiServer.deleteResource(
          'PersistentVolume',
          persistentVolume.metadata.name
        )
        releasePersistentVolumeBacking(persistentVolume.metadata.name)
        continue
      }
      const releasedPersistentVolume = {
        ...persistentVolume,
        spec: {
          ...persistentVolume.spec,
          claimRef: undefined
        },
        status: {
          ...persistentVolume.status,
          phase: 'Available' as const
        }
      }
      apiServer.updateResource(
        'PersistentVolume',
        persistentVolume.metadata.name,
        releasedPersistentVolume
      )
    }

    for (const persistentVolumeClaim of persistentVolumeClaims) {
      const claimName = persistentVolumeClaim.metadata.name
      const claimNamespace = persistentVolumeClaim.metadata.namespace
      const preBoundVolumeName = persistentVolumeClaim.spec.volumeName
      const hasPreBoundVolumeName =
        preBoundVolumeName != null && preBoundVolumeName.length > 0
      const isAlreadyBound =
        persistentVolumeClaim.status.phase === 'Bound' || hasPreBoundVolumeName
      const shouldWaitForFirstConsumer = hasWaitForFirstConsumerBindingMode(
        apiServer,
        persistentVolumeClaim.spec.storageClassName
      )
      if (shouldWaitForFirstConsumer && !isAlreadyBound) {
        const hasConsumer = hasPodConsumerForClaim(
          apiServer,
          claimNamespace,
          claimName
        )
        if (!hasConsumer) {
          volumeState.unbindClaim(claimNamespace, claimName)
          if (persistentVolumeClaim.status.phase !== 'Pending') {
            const pendingPersistentVolumeClaim = {
              ...persistentVolumeClaim,
              spec: {
                ...persistentVolumeClaim.spec,
                volumeName: undefined
              },
              status: {
                ...persistentVolumeClaim.status,
                phase: 'Pending' as const,
                accessModes: undefined,
                capacity: undefined
              }
            }
            apiServer.updateResource(
              'PersistentVolumeClaim',
              claimName,
              pendingPersistentVolumeClaim,
              claimNamespace
            )
          }
          continue
        }
      }

      if (hasPreBoundVolumeName) {
        const matchingPersistentVolume = apiServer.findResource(
          'PersistentVolume',
          preBoundVolumeName
        )
        if (
          !matchingPersistentVolume.ok ||
          matchingPersistentVolume.value == null
        ) {
          volumeState.unbindClaim(claimNamespace, claimName)
          const pendingPersistentVolumeClaim = {
            ...persistentVolumeClaim,
            spec: {
              ...persistentVolumeClaim.spec,
              volumeName: undefined
            },
            status: {
              ...persistentVolumeClaim.status,
              phase: 'Pending' as const,
              accessModes: undefined,
              capacity: undefined
            }
          }
          apiServer.updateResource(
            'PersistentVolumeClaim',
            claimName,
            pendingPersistentVolumeClaim,
            claimNamespace
          )
          continue
        }
        const persistentVolume = matchingPersistentVolume.value
        assignedVolumeNames.add(persistentVolume.metadata.name)
        const sameClaim =
          persistentVolume.spec.claimRef?.name === claimName &&
          persistentVolume.spec.claimRef?.namespace === claimNamespace
        if (!sameClaim) {
          const updatedPersistentVolume = {
            ...persistentVolume,
            spec: {
              ...persistentVolume.spec,
              claimRef: {
                namespace: claimNamespace,
                name: claimName
              }
            },
            status: {
              ...persistentVolume.status,
              phase: 'Bound' as const
            }
          }
          apiServer.updateResource(
            'PersistentVolume',
            persistentVolume.metadata.name,
            updatedPersistentVolume
          )
        }
        if (persistentVolumeClaim.status.phase !== 'Bound') {
          const updatedPersistentVolumeClaim = {
            ...persistentVolumeClaim,
            status: {
              ...persistentVolumeClaim.status,
              phase: 'Bound' as const,
              accessModes: [...persistentVolume.spec.accessModes],
              capacity: {
                storage: persistentVolume.spec.capacity.storage
              }
            }
          }
          apiServer.updateResource(
            'PersistentVolumeClaim',
            claimName,
            updatedPersistentVolumeClaim,
            claimNamespace
          )
        }
        volumeState.bindClaimToVolume(
          claimNamespace,
          claimName,
          preBoundVolumeName
        )
        continue
      }

      const candidatePersistentVolume = bindingPolicy.findCandidateVolume(
        persistentVolumes.filter(
          (persistentVolume) =>
            !assignedVolumeNames.has(persistentVolume.metadata.name)
        ),
        persistentVolumeClaim
      )

      if (candidatePersistentVolume == null) {
        volumeState.unbindClaim(claimNamespace, claimName)
        if (persistentVolumeClaim.status.phase !== 'Pending') {
          const pendingPersistentVolumeClaim = {
            ...persistentVolumeClaim,
            spec: {
              ...persistentVolumeClaim.spec,
              volumeName: undefined
            },
            status: {
              ...persistentVolumeClaim.status,
              phase: 'Pending' as const,
              accessModes: undefined,
              capacity: undefined
            }
          }
          apiServer.updateResource(
            'PersistentVolumeClaim',
            claimName,
            pendingPersistentVolumeClaim,
            claimNamespace
          )
        }
        continue
      }

      assignedVolumeNames.add(candidatePersistentVolume.metadata.name)

      const boundPersistentVolume = {
        ...candidatePersistentVolume,
        spec: {
          ...candidatePersistentVolume.spec,
          claimRef: {
            namespace: claimNamespace,
            name: claimName
          }
        },
        status: {
          ...candidatePersistentVolume.status,
          phase: 'Bound' as const
        }
      }
      apiServer.updateResource(
        'PersistentVolume',
        candidatePersistentVolume.metadata.name,
        boundPersistentVolume
      )

      const boundPersistentVolumeClaim = {
        ...persistentVolumeClaim,
        spec: {
          ...persistentVolumeClaim.spec,
          volumeName: candidatePersistentVolume.metadata.name
        },
        status: {
          ...persistentVolumeClaim.status,
          phase: 'Bound' as const,
          accessModes: [...candidatePersistentVolume.spec.accessModes],
          capacity: {
            storage: candidatePersistentVolume.spec.capacity.storage
          }
        }
      }
      apiServer.updateResource(
        'PersistentVolumeClaim',
        claimName,
        boundPersistentVolumeClaim,
        claimNamespace
      )

      volumeState.bindClaimToVolume(
        claimNamespace,
        claimName,
        candidatePersistentVolume.metadata.name
      )
    }
  }

  const onEvent = (event: { type: AppEventType }): void => {
    if (!VOLUME_BINDING_EVENTS.includes(event.type)) {
      return
    }
    reconcileVolumeClaims()
  }

  const initialSync = (): void => {
    reconcileVolumeClaims()
  }

  const resyncAll = (): void => {
    reconcileVolumeClaims()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
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
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll
  }
}
