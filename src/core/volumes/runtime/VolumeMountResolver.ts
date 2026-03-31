import type { Container, Volume } from '../../cluster/ressources/Pod'
import type { VolumeMountPlan } from './types'

const isValidMountPath = (path: string): boolean => {
  if (path.length === 0) {
    return false
  }
  if (!path.startsWith('/')) {
    return false
  }
  return true
}

export const resolveContainerVolumeMountPlans = (
  container: Container,
  volumes: readonly Volume[] | undefined
): VolumeMountPlan[] => {
  if (volumes == null || volumes.length === 0) {
    return []
  }
  const volumeByName = new Map<string, Volume>()
  for (const volume of volumes) {
    volumeByName.set(volume.name, volume)
  }
  const mounts = container.volumeMounts ?? []
  const plans: VolumeMountPlan[] = []
  for (const mount of mounts) {
    const volume = volumeByName.get(mount.name)
    if (volume == null) {
      continue
    }
    if (!isValidMountPath(mount.mountPath)) {
      continue
    }
    plans.push({
      volumeName: mount.name,
      mountPath: mount.mountPath,
      readOnly: mount.readOnly === true,
      source: volume.source
    })
  }
  return plans
}
