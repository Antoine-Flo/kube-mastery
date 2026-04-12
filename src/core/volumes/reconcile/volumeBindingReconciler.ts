import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { PersistentVolume } from '../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../cluster/ressources/PersistentVolumeClaim'
import type { VolumeBindingPolicy } from '../VolumeBindingPolicy'
import type { VolumeState } from '../VolumeState'
import {
  hasPodConsumerForClaim,
  hasWaitForFirstConsumerBindingMode
} from '../pvcBindingMode'
import { releasePersistentVolumeBacking } from '../runtime'
import {
  toBoundClaim,
  toBoundVolume,
  toPendingClaim,
  toReleasedVolume
} from './volumeBindingTransforms'

export interface VolumeBindingReconcilerDeps {
  apiServer: ApiServerFacade
  volumeState: VolumeState
  bindingPolicy: VolumeBindingPolicy
  enqueueClaim: (namespace: string, name: string) => void
  enqueueVolume: (name: string) => void
}

export const makeClaimKey = (namespace: string, name: string): string => {
  return `${namespace}/${name}`
}

export const parseClaimKey = (
  key: string
): { namespace: string; name: string } => {
  const [namespace, name] = key.split('/')
  return { namespace, name }
}

const updateClaimToPending = (
  claimNamespace: string,
  claimName: string,
  persistentVolumeClaim: PersistentVolumeClaim,
  apiServer: ApiServerFacade
): void => {
  apiServer.updateResource(
    'PersistentVolumeClaim',
    claimName,
    toPendingClaim(persistentVolumeClaim),
    claimNamespace
  )
}

export const enqueuePendingClaimsMatchingVolume = (
  persistentVolume: PersistentVolume,
  deps: Pick<VolumeBindingReconcilerDeps, 'apiServer' | 'enqueueClaim'>
): void => {
  const volumeStorageClass = persistentVolume.spec.storageClassName ?? ''
  for (const claim of deps.apiServer.listResources('PersistentVolumeClaim')) {
    if (claim.status.phase !== 'Pending') {
      continue
    }
    if (claim.spec.volumeName != null && claim.spec.volumeName.length > 0) {
      continue
    }
    const claimStorageClass = claim.spec.storageClassName ?? ''
    if (claimStorageClass !== volumeStorageClass) {
      continue
    }
    deps.enqueueClaim(claim.metadata.namespace, claim.metadata.name)
  }
}

const syncBoundClaim = (
  persistentVolumeClaim: PersistentVolumeClaim,
  deps: VolumeBindingReconcilerDeps
): void => {
  const claimName = persistentVolumeClaim.metadata.name
  const claimNamespace = persistentVolumeClaim.metadata.namespace
  const preBoundVolumeName = persistentVolumeClaim.spec.volumeName
  if (preBoundVolumeName == null || preBoundVolumeName.length === 0) {
    return
  }

  const persistentVolumeResult = deps.apiServer.findResource(
    'PersistentVolume',
    preBoundVolumeName
  )
  if (!persistentVolumeResult.ok || persistentVolumeResult.value == null) {
    deps.volumeState.unbindClaim(claimNamespace, claimName)
    updateClaimToPending(
      claimNamespace,
      claimName,
      persistentVolumeClaim,
      deps.apiServer
    )
    return
  }

  const persistentVolume = persistentVolumeResult.value
  const sameClaim =
    persistentVolume.spec.claimRef?.name === claimName &&
    persistentVolume.spec.claimRef?.namespace === claimNamespace
  const existingClaimRef = persistentVolume.spec.claimRef
  const volumeAlreadyClaimedElsewhere = existingClaimRef != null && !sameClaim
  if (volumeAlreadyClaimedElsewhere) {
    deps.volumeState.unbindClaim(claimNamespace, claimName)
    updateClaimToPending(
      claimNamespace,
      claimName,
      persistentVolumeClaim,
      deps.apiServer
    )
    return
  }

  if (!sameClaim) {
    deps.apiServer.updateResource(
      'PersistentVolume',
      persistentVolume.metadata.name,
      toBoundVolume(persistentVolume, claimNamespace, claimName)
    )
  }

  if (persistentVolumeClaim.status.phase !== 'Bound') {
    deps.apiServer.updateResource(
      'PersistentVolumeClaim',
      claimName,
      toBoundClaim(persistentVolumeClaim, persistentVolume),
      claimNamespace
    )
  }

  deps.volumeState.bindClaimToVolume(
    claimNamespace,
    claimName,
    preBoundVolumeName
  )
  deps.enqueueVolume(preBoundVolumeName)
}

const syncUnboundClaim = (
  persistentVolumeClaim: PersistentVolumeClaim,
  deps: VolumeBindingReconcilerDeps
): void => {
  const claimName = persistentVolumeClaim.metadata.name
  const claimNamespace = persistentVolumeClaim.metadata.namespace
  const shouldWaitForFirstConsumer = hasWaitForFirstConsumerBindingMode(
    deps.apiServer,
    persistentVolumeClaim.spec.storageClassName
  )
  if (shouldWaitForFirstConsumer) {
    const hasConsumer = hasPodConsumerForClaim(
      deps.apiServer,
      claimNamespace,
      claimName
    )
    if (!hasConsumer) {
      deps.volumeState.unbindClaim(claimNamespace, claimName)
      if (persistentVolumeClaim.status.phase !== 'Pending') {
        updateClaimToPending(
          claimNamespace,
          claimName,
          persistentVolumeClaim,
          deps.apiServer
        )
      }
      return
    }
  }

  const candidatePersistentVolume = deps.bindingPolicy.findCandidateVolume(
    [...deps.apiServer.listResources('PersistentVolume')],
    persistentVolumeClaim
  )
  if (candidatePersistentVolume == null) {
    deps.volumeState.unbindClaim(claimNamespace, claimName)
    if (persistentVolumeClaim.status.phase !== 'Pending') {
      updateClaimToPending(
        claimNamespace,
        claimName,
        persistentVolumeClaim,
        deps.apiServer
      )
    }
    return
  }

  deps.apiServer.updateResource(
    'PersistentVolume',
    candidatePersistentVolume.metadata.name,
    toBoundVolume(candidatePersistentVolume, claimNamespace, claimName)
  )
  deps.apiServer.updateResource(
    'PersistentVolumeClaim',
    claimName,
    toBoundClaim(persistentVolumeClaim, candidatePersistentVolume),
    claimNamespace
  )
  deps.volumeState.bindClaimToVolume(
    claimNamespace,
    claimName,
    candidatePersistentVolume.metadata.name
  )
  deps.enqueueVolume(candidatePersistentVolume.metadata.name)
}

export const reconcileClaimByKey = (
  claimKey: string,
  deps: VolumeBindingReconcilerDeps
): void => {
  const { namespace: claimNamespace, name: claimName } = parseClaimKey(claimKey)
  const claimResult = deps.apiServer.findResource(
    'PersistentVolumeClaim',
    claimName,
    claimNamespace
  )
  if (!claimResult.ok || claimResult.value == null) {
    deps.volumeState.unbindClaim(claimNamespace, claimName)
    return
  }

  const persistentVolumeClaim = claimResult.value
  const hasPreBoundVolumeName =
    persistentVolumeClaim.spec.volumeName != null &&
    persistentVolumeClaim.spec.volumeName.length > 0
  if (hasPreBoundVolumeName) {
    syncBoundClaim(persistentVolumeClaim, deps)
    return
  }
  syncUnboundClaim(persistentVolumeClaim, deps)
}

export const reconcileVolumeByKey = (
  volumeName: string,
  deps: VolumeBindingReconcilerDeps
): void => {
  const persistentVolumeResult = deps.apiServer.findResource(
    'PersistentVolume',
    volumeName
  )
  if (!persistentVolumeResult.ok || persistentVolumeResult.value == null) {
    return
  }
  const persistentVolume = persistentVolumeResult.value
  const claimRef = persistentVolume.spec.claimRef
  if (claimRef == null) {
    enqueuePendingClaimsMatchingVolume(persistentVolume, deps)
    return
  }

  const claimResult = deps.apiServer.findResource(
    'PersistentVolumeClaim',
    claimRef.name,
    claimRef.namespace
  )
  if (!claimResult.ok || claimResult.value == null) {
    if (persistentVolume.spec.persistentVolumeReclaimPolicy === 'Delete') {
      deps.apiServer.deleteResource(
        'PersistentVolume',
        persistentVolume.metadata.name
      )
      releasePersistentVolumeBacking(persistentVolume.metadata.name)
      return
    }
    deps.apiServer.updateResource(
      'PersistentVolume',
      persistentVolume.metadata.name,
      toReleasedVolume(persistentVolume)
    )
    return
  }

  deps.enqueueClaim(claimRef.namespace, claimRef.name)
}
