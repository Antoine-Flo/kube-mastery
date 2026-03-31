import type { FileSystemState } from '../../../filesystem/FileSystem'
import type { Volume } from '../../../cluster/ressources/Pod'
import type { VolumeRuntimeContext, VolumeRuntimeProvider } from '../types'
import {
  createBackingFromKeyValueData,
  createEmptyVolumeBacking
} from './sharedVolumeFileBuilder'

const buildConfigMapBacking = (
  volume: Volume,
  context: VolumeRuntimeContext | undefined
): FileSystemState | undefined => {
  if (volume.source.type !== 'configMap') {
    return undefined
  }
  if (context?.findConfigMap == null) {
    return undefined
  }
  const configMap = context.findConfigMap(volume.source.name, context.namespace)
  if (configMap == null) {
    return undefined
  }
  return createBackingFromKeyValueData(
    configMap.data ?? {},
    volume.source.items
  )
}

export const createConfigMapProvider = (): VolumeRuntimeProvider => {
  return {
    canHandle: (source) => {
      return source.type === 'configMap'
    },
    ensurePodVolume: (
      volume: Volume,
      existingBacking: FileSystemState | undefined,
      context?: VolumeRuntimeContext
    ) => {
      const configMapBacking = buildConfigMapBacking(volume, context)
      if (configMapBacking != null) {
        return configMapBacking
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
