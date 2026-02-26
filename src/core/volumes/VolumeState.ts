import type { PersistentVolume } from '../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../cluster/ressources/PersistentVolumeClaim'

export interface PodVolumeReadiness {
  ready: boolean
  reason?: string
}

export interface VolumeState {
  setPodReadiness: (
    namespace: string,
    podName: string,
    readiness: PodVolumeReadiness
  ) => void
  getPodReadiness: (
    namespace: string,
    podName: string
  ) => PodVolumeReadiness | undefined
  removePodReadiness: (namespace: string, podName: string) => void
  bindClaimToVolume: (claimNamespace: string, claimName: string, volumeName: string) => void
  unbindClaim: (claimNamespace: string, claimName: string) => void
  getBoundVolumeForClaim: (
    claimNamespace: string,
    claimName: string
  ) => string | undefined
  reserveHostPath: (nodeName: string, hostPath: string) => void
  hasHostPath: (nodeName: string, hostPath: string) => boolean
  listClaimBindings: () => Array<{
    claimNamespace: string
    claimName: string
    volumeName: string
  }>
}

const podKey = (namespace: string, podName: string): string => {
  return `${namespace}/${podName}`
}

const claimKey = (claimNamespace: string, claimName: string): string => {
  return `${claimNamespace}/${claimName}`
}

const hostPathKey = (nodeName: string, hostPath: string): string => {
  return `${nodeName}:${hostPath}`
}

export const createVolumeState = (): VolumeState => {
  const podReadinessByKey = new Map<string, PodVolumeReadiness>()
  const claimToVolumeByKey = new Map<string, string>()
  const hostPathReservations = new Set<string>()

  const setPodReadiness = (
    namespace: string,
    podName: string,
    readiness: PodVolumeReadiness
  ): void => {
    podReadinessByKey.set(podKey(namespace, podName), readiness)
  }

  const getPodReadiness = (
    namespace: string,
    podName: string
  ): PodVolumeReadiness | undefined => {
    return podReadinessByKey.get(podKey(namespace, podName))
  }

  const removePodReadiness = (namespace: string, podName: string): void => {
    podReadinessByKey.delete(podKey(namespace, podName))
  }

  const bindClaimToVolume = (
    claimNamespace: string,
    claimName: string,
    volumeName: string
  ): void => {
    claimToVolumeByKey.set(claimKey(claimNamespace, claimName), volumeName)
  }

  const unbindClaim = (claimNamespace: string, claimName: string): void => {
    claimToVolumeByKey.delete(claimKey(claimNamespace, claimName))
  }

  const getBoundVolumeForClaim = (
    claimNamespace: string,
    claimName: string
  ): string | undefined => {
    return claimToVolumeByKey.get(claimKey(claimNamespace, claimName))
  }

  const reserveHostPath = (nodeName: string, hostPath: string): void => {
    hostPathReservations.add(hostPathKey(nodeName, hostPath))
  }

  const hasHostPath = (nodeName: string, hostPath: string): boolean => {
    return hostPathReservations.has(hostPathKey(nodeName, hostPath))
  }

  const listClaimBindings = (): Array<{
    claimNamespace: string
    claimName: string
    volumeName: string
  }> => {
    const list: Array<{
      claimNamespace: string
      claimName: string
      volumeName: string
    }> = []
    for (const [key, volumeName] of claimToVolumeByKey.entries()) {
      const [claimNamespace, claimName] = key.split('/')
      list.push({ claimNamespace, claimName, volumeName })
    }
    return list
  }

  return {
    setPodReadiness,
    getPodReadiness,
    removePodReadiness,
    bindClaimToVolume,
    unbindClaim,
    getBoundVolumeForClaim,
    reserveHostPath,
    hasHostPath,
    listClaimBindings
  }
}

export const isPersistentVolumeAvailable = (persistentVolume: PersistentVolume): boolean => {
  if (persistentVolume.status.phase === 'Bound') {
    return false
  }
  return persistentVolume.spec.claimRef == null
}

export const isPersistentVolumeClaimBound = (
  persistentVolumeClaim: PersistentVolumeClaim
): boolean => {
  return (
    persistentVolumeClaim.status.phase === 'Bound' &&
    persistentVolumeClaim.spec.volumeName != null
  )
}
