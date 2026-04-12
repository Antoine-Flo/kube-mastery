import type { ApiServerFacade } from '../../api/ApiServerFacade'
import { createPersistentVolume } from '../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../cluster/ressources/PersistentVolumeClaim'
import type { StorageClass } from '../../cluster/ressources/StorageClass'
import type { VolumeBindingPolicy } from '../VolumeBindingPolicy'
import {
  hasPodConsumerForClaim,
  hasWaitForFirstConsumerBindingMode
} from '../pvcBindingMode'

export type VolumeProvisioningLifecycleReason =
  | 'Provisioning'
  | 'ProvisioningSucceeded'
  | 'FailedBinding'
  | 'WaitForFirstConsumer'
  | 'Skip'

export interface VolumeProvisioningReconcileResult {
  reason: VolumeProvisioningLifecycleReason
  lifecycleEvent?: {
    namespace: string
    name: string
    reason: string
    message: string
    eventType: 'Normal' | 'Warning'
    source: string
  }
}

export interface VolumeProvisioningReconcilerDeps {
  apiServer: ApiServerFacade
  bindingPolicy: VolumeBindingPolicy
}

const DEFAULT_STORAGE_CLASS_ANNOTATION =
  'storageclass.kubernetes.io/is-default-class'
const PERSISTENT_VOLUME_CONTROLLER_SOURCE = 'persistentvolume-controller'

export const makeProvisioningClaimKey = (
  namespace: string,
  name: string
): string => {
  return `${namespace}/${name}`
}

export const parseProvisioningClaimKey = (
  claimKey: string
): { namespace: string; name: string } => {
  const [namespace, name] = claimKey.split('/')
  return { namespace, name }
}

export const resolveDefaultStorageClass = (
  storageClasses: readonly StorageClass[]
): StorageClass | undefined => {
  return storageClasses.find((storageClass) => {
    return (
      storageClass.metadata.annotations?.[DEFAULT_STORAGE_CLASS_ANNOTATION] ===
      'true'
    )
  })
}

const resolveProvisionerSource = (
  storageClasses: readonly StorageClass[],
  storageClassName: string
): string => {
  const storageClass = storageClasses.find((candidateStorageClass) => {
    return candidateStorageClass.metadata.name === storageClassName
  })
  if (storageClass == null) {
    return `${storageClassName}-provisioner`
  }
  const provisioner = storageClass.provisioner
  if (provisioner.length === 0) {
    return `${storageClassName}-provisioner`
  }
  const provisionerNameSegment = provisioner.includes('/')
    ? (provisioner.split('/').at(-1) ?? provisioner)
    : provisioner
  return `${provisioner}_${provisionerNameSegment}-provisioner`
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

const syncClaimStorageClass = (
  persistentVolumeClaim: PersistentVolumeClaim,
  deps: VolumeProvisioningReconcilerDeps
): PersistentVolumeClaim => {
  const storageClasses = deps.apiServer.listResources('StorageClass')
  const defaultStorageClass = resolveDefaultStorageClass(storageClasses)
  return ensureClaimStorageClassName(
    deps.apiServer,
    persistentVolumeClaim,
    defaultStorageClass
  )
}

const syncClaimProvisioning = (
  persistentVolumeClaim: PersistentVolumeClaim,
  deps: VolumeProvisioningReconcilerDeps
): VolumeProvisioningReconcileResult => {
  if (persistentVolumeClaim.status.phase !== 'Pending') {
    return { reason: 'Skip' }
  }
  if (
    persistentVolumeClaim.spec.volumeName != null &&
    persistentVolumeClaim.spec.volumeName.length > 0
  ) {
    return { reason: 'Skip' }
  }

  const claimStorageClassName = persistentVolumeClaim.spec.storageClassName
  if (claimStorageClassName == null || claimStorageClassName.length === 0) {
    return {
      reason: 'FailedBinding',
      lifecycleEvent: {
        namespace: persistentVolumeClaim.metadata.namespace,
        name: persistentVolumeClaim.metadata.name,
        reason: 'FailedBinding',
        message:
          'no persistent volumes available for this claim and no storage class is set',
        eventType: 'Warning',
        source: PERSISTENT_VOLUME_CONTROLLER_SOURCE
      }
    }
  }
  const storageClasses = deps.apiServer.listResources('StorageClass')
  const targetStorageClass = storageClasses.find((storageClass) => {
    return storageClass.metadata.name === claimStorageClassName
  })
  if (targetStorageClass == null) {
    return {
      reason: 'FailedBinding',
      lifecycleEvent: {
        namespace: persistentVolumeClaim.metadata.namespace,
        name: persistentVolumeClaim.metadata.name,
        reason: 'FailedBinding',
        message: `storageclass.storage.k8s.io "${claimStorageClassName}" not found`,
        eventType: 'Warning',
        source: PERSISTENT_VOLUME_CONTROLLER_SOURCE
      }
    }
  }

  const shouldWaitForFirstConsumer = hasWaitForFirstConsumerBindingMode(
    deps.apiServer,
    claimStorageClassName
  )
  if (shouldWaitForFirstConsumer) {
    const hasConsumer = hasPodConsumerForClaim(
      deps.apiServer,
      persistentVolumeClaim.metadata.namespace,
      persistentVolumeClaim.metadata.name
    )
    if (!hasConsumer) {
      return {
        reason: 'WaitForFirstConsumer',
        lifecycleEvent: {
          namespace: persistentVolumeClaim.metadata.namespace,
          name: persistentVolumeClaim.metadata.name,
          reason: 'WaitForFirstConsumer',
          message: 'waiting for first consumer to be created before binding',
          eventType: 'Normal',
          source: PERSISTENT_VOLUME_CONTROLLER_SOURCE
        }
      }
    }
  }

  const persistentVolumes = [
    ...deps.apiServer.listResources('PersistentVolume')
  ]
  const candidatePersistentVolume = deps.bindingPolicy.findCandidateVolume(
    persistentVolumes,
    persistentVolumeClaim
  )
  if (candidatePersistentVolume != null) {
    return { reason: 'Skip' }
  }

  const dynamicPersistentVolume = createDynamicallyProvisionedPersistentVolume(
    persistentVolumeClaim,
    targetStorageClass
  )
  const existingDynamicVolume = deps.apiServer.findResource(
    'PersistentVolume',
    dynamicPersistentVolume.metadata.name
  )
  if (existingDynamicVolume.ok) {
    return { reason: 'Skip' }
  }

  const provisionerSource = resolveProvisionerSource(
    storageClasses,
    targetStorageClass.metadata.name
  )
  deps.apiServer.createResource('PersistentVolume', dynamicPersistentVolume)
  return {
    reason: 'ProvisioningSucceeded',
    lifecycleEvent: {
      namespace: persistentVolumeClaim.metadata.namespace,
      name: persistentVolumeClaim.metadata.name,
      reason: 'ProvisioningSucceeded',
      message: `Successfully provisioned volume ${dynamicPersistentVolume.metadata.name}`,
      eventType: 'Normal',
      source: provisionerSource
    }
  }
}

export const reconcileProvisioningClaimByKey = (
  claimKey: string,
  deps: VolumeProvisioningReconcilerDeps
): VolumeProvisioningReconcileResult => {
  const { namespace, name } = parseProvisioningClaimKey(claimKey)
  const claimResult = deps.apiServer.findResource(
    'PersistentVolumeClaim',
    name,
    namespace
  )
  if (!claimResult.ok || claimResult.value == null) {
    return { reason: 'Skip' }
  }

  const claimWithStorageClass = syncClaimStorageClass(claimResult.value, deps)
  const syncResult = syncClaimProvisioning(claimWithStorageClass, deps)
  if (syncResult.reason === 'ProvisioningSucceeded') {
    return syncResult
  }
  if (
    syncResult.reason === 'WaitForFirstConsumer' ||
    syncResult.reason === 'FailedBinding'
  ) {
    return syncResult
  }
  if (
    claimWithStorageClass.status.phase === 'Pending' &&
    claimWithStorageClass.spec.storageClassName != null
  ) {
    const storageClasses = deps.apiServer.listResources('StorageClass')
    const provisionerSource = resolveProvisionerSource(
      storageClasses,
      claimWithStorageClass.spec.storageClassName
    )
    return {
      reason: 'Provisioning',
      lifecycleEvent: {
        namespace: claimWithStorageClass.metadata.namespace,
        name: claimWithStorageClass.metadata.name,
        reason: 'Provisioning',
        message: `External provisioner is provisioning volume for claim "${claimWithStorageClass.metadata.namespace}/${claimWithStorageClass.metadata.name}"`,
        eventType: 'Normal',
        source: provisionerSource
      }
    }
  }
  return { reason: 'Skip' }
}
