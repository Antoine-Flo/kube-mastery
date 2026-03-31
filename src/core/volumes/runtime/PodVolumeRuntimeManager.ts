import type { Container, Volume } from '../../cluster/ressources/Pod'
import { resolveContainerVolumeMountPlans } from './VolumeMountResolver'
import type {
  PodVolumeBackingMap,
  PodVolumeRuntimeManager,
  VolumeRuntimeContext,
  VolumeMountBinding,
  VolumeRuntimeProvider
} from './types'

const findProvider = (
  providers: readonly VolumeRuntimeProvider[],
  volume: Volume
): VolumeRuntimeProvider | undefined => {
  return providers.find((provider) => {
    return provider.canHandle(volume.source)
  })
}

const buildVolumeByName = (
  volumes: readonly Volume[] | undefined
): Map<string, Volume> => {
  const volumeByName = new Map<string, Volume>()
  for (const volume of volumes ?? []) {
    volumeByName.set(volume.name, volume)
  }
  return volumeByName
}

export const createPodVolumeRuntimeManager = (
  providers: readonly VolumeRuntimeProvider[]
): PodVolumeRuntimeManager => {
  const ensurePodVolumeBackings = (
    volumes: readonly Volume[] | undefined,
    existingBackings: PodVolumeBackingMap | undefined,
    context?: VolumeRuntimeContext
  ): PodVolumeBackingMap => {
    const nextBackings: PodVolumeBackingMap = {}
    for (const volume of volumes ?? []) {
      const provider = findProvider(providers, volume)
      if (provider == null) {
        continue
      }
      const existingBacking = existingBackings?.[volume.name]
      nextBackings[volume.name] = provider.ensurePodVolume(
        volume,
        existingBacking,
        context
      )
    }
    return nextBackings
  }

  const buildContainerMountBindings = (
    container: Container,
    volumes: readonly Volume[] | undefined,
    backings: PodVolumeBackingMap
  ): VolumeMountBinding[] => {
    const plans = resolveContainerVolumeMountPlans(container, volumes)
    const volumeByName = buildVolumeByName(volumes)
    const bindings: VolumeMountBinding[] = []
    for (const plan of plans) {
      const volume = volumeByName.get(plan.volumeName)
      if (volume == null) {
        continue
      }
      const provider = findProvider(providers, volume)
      if (provider == null) {
        continue
      }
      const backing = backings[plan.volumeName]
      if (backing == null) {
        continue
      }
      bindings.push(provider.buildMountBinding(plan, backing))
    }
    return bindings
  }

  const cleanupPodVolumeBackings = (
    volumes: readonly Volume[] | undefined,
    backings: PodVolumeBackingMap
  ): PodVolumeBackingMap => {
    const cleanedBackings: PodVolumeBackingMap = {}
    const volumeByName = buildVolumeByName(volumes)
    for (const [volumeName, backing] of Object.entries(backings)) {
      const volume = volumeByName.get(volumeName)
      if (volume == null) {
        continue
      }
      const provider = findProvider(providers, volume)
      if (provider == null) {
        continue
      }
      const cleanedBacking = provider.cleanupPodVolume(volume, backing)
      if (cleanedBacking == null) {
        continue
      }
      cleanedBackings[volumeName] = cleanedBacking
    }
    return cleanedBackings
  }

  return {
    ensurePodVolumeBackings,
    buildContainerMountBindings,
    cleanupPodVolumeBackings
  }
}
