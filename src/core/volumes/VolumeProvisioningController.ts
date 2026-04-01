import { startPeriodicResync } from '../control-plane/controller-runtime/helpers'
import type { ApiServerFacade } from '../api/ApiServerFacade'
import { createPersistentVolume } from '../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../cluster/ressources/PersistentVolumeClaim'
import type { StorageClass } from '../cluster/ressources/StorageClass'
import type { AppEventType } from '../events/AppEvent'
import {
  createVolumeBindingPolicy,
  type VolumeBindingPolicy
} from './VolumeBindingPolicy'
import {
  hasPodConsumerForClaim,
  hasWaitForFirstConsumerBindingMode
} from './pvcBindingMode'

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

const DEFAULT_STORAGE_CLASS_ANNOTATION =
  'storageclass.kubernetes.io/is-default-class'

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

const resolveDefaultStorageClass = (
  storageClasses: readonly StorageClass[]
): StorageClass | undefined => {
  return storageClasses.find((storageClass) => {
    return (
      storageClass.metadata.annotations?.[DEFAULT_STORAGE_CLASS_ANNOTATION] ===
      'true'
    )
  })
}

const sanitizeNameSegment = (value: string): string => {
  const lowered = value.toLowerCase()
  const sanitized = lowered.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
  const trimmed = sanitized.replace(/^-+/, '').replace(/-+$/, '')
  if (trimmed.length > 0) {
    return trimmed
  }
  return 'claim'
}

const createDynamicPersistentVolumeName = (
  claimNamespace: string,
  claimName: string
): string => {
  const namespaceSegment = sanitizeNameSegment(claimNamespace)
  const claimSegment = sanitizeNameSegment(claimName)
  return `pvc-${namespaceSegment}-${claimSegment}`
}

const ensureClaimStorageClassName = (
  apiServer: ApiServerFacade,
  persistentVolumeClaim: PersistentVolumeClaim,
  defaultStorageClass: StorageClass | undefined
): PersistentVolumeClaim => {
  if (persistentVolumeClaim.spec.storageClassName != null) {
    return persistentVolumeClaim
  }
  if (defaultStorageClass == null) {
    return persistentVolumeClaim
  }
  const updatedPersistentVolumeClaim: PersistentVolumeClaim = {
    ...persistentVolumeClaim,
    spec: {
      ...persistentVolumeClaim.spec,
      storageClassName: defaultStorageClass.metadata.name
    }
  }
  apiServer.updateResource(
    'PersistentVolumeClaim',
    persistentVolumeClaim.metadata.name,
    updatedPersistentVolumeClaim,
    persistentVolumeClaim.metadata.namespace
  )
  return updatedPersistentVolumeClaim
}

const createDynamicallyProvisionedPersistentVolume = (
  persistentVolumeClaim: PersistentVolumeClaim,
  storageClass: StorageClass
) => {
  const volumeName = createDynamicPersistentVolumeName(
    persistentVolumeClaim.metadata.namespace,
    persistentVolumeClaim.metadata.name
  )
  return createPersistentVolume({
    name: volumeName,
    spec: {
      capacity: {
        storage: persistentVolumeClaim.spec.resources.requests.storage
      },
      accessModes: persistentVolumeClaim.spec.accessModes,
      storageClassName: storageClass.metadata.name,
      persistentVolumeReclaimPolicy: storageClass.reclaimPolicy,
      hostPath: {
        path: `/sim/dynamic-pv/${volumeName}`
      }
    }
  })
}

export const createVolumeProvisioningController = (
  apiServer: ApiServerFacade,
  options: VolumeProvisioningControllerOptions = {}
): VolumeProvisioningController => {
  const eventBus = apiServer.getEventBus()
  const bindingPolicy = options.policy ?? createVolumeBindingPolicy()
  let started = false
  let unsubscribeEvents: (() => void) | undefined
  let stopResync: (() => void) | undefined

  const reconcileProvisioning = (): void => {
    const persistentVolumes = [...apiServer.listResources('PersistentVolume')]
    const storageClasses = apiServer.listResources('StorageClass')
    const defaultStorageClass = resolveDefaultStorageClass(storageClasses)
    const persistentVolumeClaims = apiServer.listResources('PersistentVolumeClaim')
    for (const unresolvedPersistentVolumeClaim of persistentVolumeClaims) {
      const persistentVolumeClaim = ensureClaimStorageClassName(
        apiServer,
        unresolvedPersistentVolumeClaim,
        defaultStorageClass
      )
      if (persistentVolumeClaim.status.phase !== 'Pending') {
        continue
      }
      if (
        persistentVolumeClaim.spec.volumeName != null &&
        persistentVolumeClaim.spec.volumeName.length > 0
      ) {
        continue
      }
      const claimStorageClassName = persistentVolumeClaim.spec.storageClassName
      if (claimStorageClassName == null || claimStorageClassName.length === 0) {
        continue
      }
      const targetStorageClass = storageClasses.find((storageClass) => {
        return storageClass.metadata.name === claimStorageClassName
      })
      if (targetStorageClass == null) {
        continue
      }
      const shouldWaitForFirstConsumer = hasWaitForFirstConsumerBindingMode(
        apiServer,
        claimStorageClassName
      )
      if (shouldWaitForFirstConsumer) {
        const hasConsumer = hasPodConsumerForClaim(
          apiServer,
          persistentVolumeClaim.metadata.namespace,
          persistentVolumeClaim.metadata.name
        )
        if (!hasConsumer) {
          continue
        }
      }
      const candidatePersistentVolume = bindingPolicy.findCandidateVolume(
        persistentVolumes,
        persistentVolumeClaim
      )
      if (candidatePersistentVolume != null) {
        continue
      }
      const dynamicPersistentVolume = createDynamicallyProvisionedPersistentVolume(
        persistentVolumeClaim,
        targetStorageClass
      )
      const existingDynamicVolume = apiServer.findResource(
        'PersistentVolume',
        dynamicPersistentVolume.metadata.name
      )
      if (existingDynamicVolume.ok) {
        continue
      }
      apiServer.createResource('PersistentVolume', dynamicPersistentVolume)
      persistentVolumes.push(dynamicPersistentVolume)
    }
  }

  const onEvent = (event: { type: AppEventType }): void => {
    if (!PROVISIONING_EVENTS.includes(event.type)) {
      return
    }
    reconcileProvisioning()
  }

  const initialSync = (): void => {
    reconcileProvisioning()
  }

  const resyncAll = (): void => {
    reconcileProvisioning()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
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
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll
  }
}
