import type { FileSystemState } from '../../../filesystem/FileSystem'
import type { Volume } from '../../../cluster/ressources/Pod'
import type { VolumeRuntimeContext, VolumeRuntimeProvider } from '../types'
import {
  createBackingFromKeyValueData,
  createEmptyVolumeBacking
} from './sharedVolumeFileBuilder'

const decodeBase64 = (value: string): string => {
  try {
    return atob(value)
  } catch {
    return value
  }
}

const buildSecretBacking = (
  volume: Volume,
  context: VolumeRuntimeContext | undefined
): FileSystemState | undefined => {
  if (volume.source.type !== 'secret') {
    return undefined
  }
  if (context?.findSecret == null) {
    return undefined
  }
  const secret = context.findSecret(volume.source.secretName, context.namespace)
  if (secret == null) {
    return undefined
  }
  const decodedSecretData: Record<string, string> = {}
  for (const [key, value] of Object.entries(secret.data)) {
    decodedSecretData[key] = decodeBase64(value)
  }
  return createBackingFromKeyValueData(decodedSecretData, undefined)
}

export const createSecretProvider = (): VolumeRuntimeProvider => {
  return {
    canHandle: (source) => {
      return source.type === 'secret'
    },
    ensurePodVolume: (
      volume: Volume,
      existingBacking: FileSystemState | undefined,
      context?: VolumeRuntimeContext
    ) => {
      const secretBacking = buildSecretBacking(volume, context)
      if (secretBacking != null) {
        return secretBacking
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
