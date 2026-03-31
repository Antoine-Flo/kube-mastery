import type { FileSystemState } from '../../../filesystem/FileSystem'
import type { Volume } from '../../../cluster/ressources/Pod'
import type { VolumeRuntimeProvider } from '../types'
import { createEmptyVolumeBacking } from './sharedVolumeFileBuilder'

export const createEmptyDirProvider = (): VolumeRuntimeProvider => {
  return {
    canHandle: (source) => {
      return source.type === 'emptyDir'
    },
    ensurePodVolume: (
      _volume: Volume,
      existingBacking: FileSystemState | undefined
    ) => {
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
