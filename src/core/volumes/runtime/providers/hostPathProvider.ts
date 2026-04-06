import type { FileSystemState } from '../../../filesystem/FileSystem'
import type { Volume } from '../../../cluster/ressources/Pod'
import type { VolumeRuntimeProvider } from '../types'
import { createEmptyVolumeBacking } from './sharedVolumeFileBuilder'

const hostPathBackingByPath = new Map<string, FileSystemState>()

const getHostPathBacking = (
  hostPath: string,
  existingBacking: FileSystemState | undefined
): FileSystemState => {
  if (existingBacking != null) {
    return existingBacking
  }
  const sharedBacking = hostPathBackingByPath.get(hostPath)
  if (sharedBacking != null) {
    return sharedBacking
  }
  const createdBacking = createEmptyVolumeBacking()
  hostPathBackingByPath.set(hostPath, createdBacking)
  return createdBacking
}

export const createHostPathProvider = (): VolumeRuntimeProvider => {
  return {
    canHandle: (source) => {
      return source.type === 'hostPath'
    },
    ensurePodVolume: (
      volume: Volume,
      existingBacking: FileSystemState | undefined
    ) => {
      if (volume.source.type !== 'hostPath') {
        return createEmptyVolumeBacking()
      }
      return getHostPathBacking(volume.source.path, existingBacking)
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
