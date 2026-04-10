import type { PersistentVolume } from '../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../cluster/ressources/PersistentVolumeClaim'

export const toPendingClaim = (
  persistentVolumeClaim: PersistentVolumeClaim
): PersistentVolumeClaim => {
  return {
    ...persistentVolumeClaim,
    spec: {
      ...persistentVolumeClaim.spec,
      volumeName: undefined
    },
    status: {
      ...persistentVolumeClaim.status,
      phase: 'Pending',
      accessModes: undefined,
      capacity: undefined
    }
  }
}

export const toBoundVolume = (
  persistentVolume: PersistentVolume,
  claimNamespace: string,
  claimName: string
): PersistentVolume => {
  return {
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
      phase: 'Bound'
    }
  }
}

export const toReleasedVolume = (
  persistentVolume: PersistentVolume
): PersistentVolume => {
  return {
    ...persistentVolume,
    spec: {
      ...persistentVolume.spec,
      claimRef: undefined
    },
    status: {
      ...persistentVolume.status,
      phase: 'Available'
    }
  }
}

export const toBoundClaim = (
  persistentVolumeClaim: PersistentVolumeClaim,
  persistentVolume: PersistentVolume
): PersistentVolumeClaim => {
  return {
    ...persistentVolumeClaim,
    spec: {
      ...persistentVolumeClaim.spec,
      volumeName: persistentVolume.metadata.name
    },
    status: {
      ...persistentVolumeClaim.status,
      phase: 'Bound',
      accessModes: [...persistentVolume.spec.accessModes],
      capacity: {
        storage: persistentVolume.spec.capacity.storage
      }
    }
  }
}
