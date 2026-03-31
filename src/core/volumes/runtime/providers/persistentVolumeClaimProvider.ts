import type { FileSystemState } from '../../../filesystem/FileSystem'
import type { PersistentVolume } from '../../../cluster/ressources/PersistentVolume'
import type { Volume } from '../../../cluster/ressources/Pod'
import type {
  VolumeRuntimeContext,
  VolumeRuntimeProvider
} from '../types'
import type { PersistentVolumeBackingStore } from '../PersistentVolumeBackingStore'
import { createEmptyVolumeBacking } from './sharedVolumeFileBuilder'

const resolveBoundPersistentVolume = (
  volume: Volume,
  context: VolumeRuntimeContext | undefined
): PersistentVolume | undefined => {
  if (volume.source.type !== 'persistentVolumeClaim') {
    return undefined
  }
  if (
    context?.findPersistentVolumeClaim == null ||
    context.findPersistentVolume == null
  ) {
    return undefined
  }
  const claim = context.findPersistentVolumeClaim(
    volume.source.claimName,
    context.namespace
  )
  if (claim == null) {
    return undefined
  }
  const volumeName = claim.spec.volumeName
  if (volumeName == null || volumeName.length === 0) {
    return undefined
  }
  return context.findPersistentVolume(volumeName)
}

export const createPersistentVolumeClaimProvider = (
  persistentVolumeBackingStore: PersistentVolumeBackingStore
): VolumeRuntimeProvider => {
  return {
    canHandle: (source) => {
      return source.type === 'persistentVolumeClaim'
    },
    ensurePodVolume: (
      volume: Volume,
      existingBacking: FileSystemState | undefined,
      context?: VolumeRuntimeContext
    ) => {
      const persistentVolume = resolveBoundPersistentVolume(volume, context)
      if (persistentVolume != null) {
        return persistentVolumeBackingStore.getOrCreate(persistentVolume)
      }
      if (existingBacking != null) {
        return existingBacking
      }
      return createEmptyVolumeBacking()
    },
    buildMountBinding: (plan, backing) => {
      return {
        volumeName: plan.volumeName,
        mountPath: plan.mountPath,
        readOnly: plan.readOnly,
        backing
      }
    },
    cleanupPodVolume: (_volume, backing) => {
      return backing
    }
  }
}
