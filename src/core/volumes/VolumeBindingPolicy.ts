import type { PersistentVolume } from '../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../cluster/ressources/PersistentVolumeClaim'

export interface VolumeBindingPolicy {
  parseStorageToBytes: (rawValue: string) => number
  isVolumeAvailable: (persistentVolume: PersistentVolume) => boolean
  matchesStorageClass: (
    persistentVolume: PersistentVolume,
    persistentVolumeClaim: PersistentVolumeClaim
  ) => boolean
  supportsAccessModes: (
    persistentVolume: PersistentVolume,
    persistentVolumeClaim: PersistentVolumeClaim
  ) => boolean
  hasEnoughCapacity: (
    persistentVolume: PersistentVolume,
    persistentVolumeClaim: PersistentVolumeClaim
  ) => boolean
  findCandidateVolume: (
    persistentVolumes: PersistentVolume[],
    persistentVolumeClaim: PersistentVolumeClaim
  ) => PersistentVolume | undefined
}

const createBinaryUnits = (): Record<string, number> => {
  return {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4
  }
}

export const createVolumeBindingPolicy = (): VolumeBindingPolicy => {
  const binaryUnits = createBinaryUnits()

  const parseStorageToBytes = (rawValue: string): number => {
    const normalized = rawValue.trim()
    for (const [unit, multiplier] of Object.entries(binaryUnits)) {
      if (normalized.endsWith(unit)) {
        const numeric = Number.parseFloat(normalized.slice(0, -2))
        if (Number.isNaN(numeric)) {
          return 0
        }
        return Math.floor(numeric * multiplier)
      }
    }

    const asNumber = Number.parseFloat(normalized)
    if (Number.isNaN(asNumber)) {
      return 0
    }
    return Math.floor(asNumber)
  }

  const isVolumeAvailable = (persistentVolume: PersistentVolume): boolean => {
    if (persistentVolume.status.phase === 'Bound') {
      return false
    }
    return persistentVolume.spec.claimRef == null
  }

  const matchesStorageClass = (
    persistentVolume: PersistentVolume,
    persistentVolumeClaim: PersistentVolumeClaim
  ): boolean => {
    return (
      (persistentVolume.spec.storageClassName ?? '') ===
      (persistentVolumeClaim.spec.storageClassName ?? '')
    )
  }

  const supportsAccessModes = (
    persistentVolume: PersistentVolume,
    persistentVolumeClaim: PersistentVolumeClaim
  ): boolean => {
    return persistentVolumeClaim.spec.accessModes.every((claimAccessMode) => {
      return persistentVolume.spec.accessModes.includes(claimAccessMode)
    })
  }

  const hasEnoughCapacity = (
    persistentVolume: PersistentVolume,
    persistentVolumeClaim: PersistentVolumeClaim
  ): boolean => {
    const requestedBytes = parseStorageToBytes(
      persistentVolumeClaim.spec.resources.requests.storage
    )
    const availableBytes = parseStorageToBytes(
      persistentVolume.spec.capacity.storage
    )
    return availableBytes >= requestedBytes
  }

  const findCandidateVolume = (
    persistentVolumes: PersistentVolume[],
    persistentVolumeClaim: PersistentVolumeClaim
  ): PersistentVolume | undefined => {
    return persistentVolumes.find((persistentVolume) => {
      if (!isVolumeAvailable(persistentVolume)) {
        return false
      }
      if (!matchesStorageClass(persistentVolume, persistentVolumeClaim)) {
        return false
      }
      if (!supportsAccessModes(persistentVolume, persistentVolumeClaim)) {
        return false
      }
      return hasEnoughCapacity(persistentVolume, persistentVolumeClaim)
    })
  }

  return {
    parseStorageToBytes,
    isVolumeAvailable,
    matchesStorageClass,
    supportsAccessModes,
    hasEnoughCapacity,
    findCandidateVolume
  }
}
