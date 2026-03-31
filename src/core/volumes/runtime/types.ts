import type { FileSystemState } from '../../filesystem/FileSystem'
import type { Container, Volume, VolumeSource } from '../../cluster/ressources/Pod'
import type { ConfigMap } from '../../cluster/ressources/ConfigMap'
import type { PersistentVolume } from '../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../cluster/ressources/PersistentVolumeClaim'
import type { Secret } from '../../cluster/ressources/Secret'

export type PodVolumeBackingMap = Record<string, FileSystemState>

export interface VolumeMountPlan {
  volumeName: string
  mountPath: string
  readOnly: boolean
  source: VolumeSource
}

export interface VolumeMountBinding {
  volumeName: string
  mountPath: string
  readOnly: boolean
  backing: FileSystemState
}

export interface VolumeRuntimeContext {
  findConfigMap?: (name: string, namespace: string) => ConfigMap | undefined
  findPersistentVolume?: (name: string) => PersistentVolume | undefined
  findPersistentVolumeClaim?: (
    name: string,
    namespace: string
  ) => PersistentVolumeClaim | undefined
  findSecret?: (name: string, namespace: string) => Secret | undefined
  namespace: string
}

export interface VolumeRuntimeProvider {
  canHandle: (source: VolumeSource) => boolean
  ensurePodVolume: (
    volume: Volume,
    existingBacking: FileSystemState | undefined,
    context?: VolumeRuntimeContext
  ) => FileSystemState
  buildMountBinding: (
    plan: VolumeMountPlan,
    backing: FileSystemState
  ) => VolumeMountBinding
  cleanupPodVolume: (
    volume: Volume,
    backing: FileSystemState
  ) => FileSystemState | undefined
}

export interface PodVolumeRuntimeManager {
  ensurePodVolumeBackings: (
    volumes: readonly Volume[] | undefined,
    existingBackings: PodVolumeBackingMap | undefined,
    context?: VolumeRuntimeContext
  ) => PodVolumeBackingMap
  buildContainerMountBindings: (
    container: Container,
    volumes: readonly Volume[] | undefined,
    backings: PodVolumeBackingMap
  ) => VolumeMountBinding[]
  cleanupPodVolumeBackings: (
    volumes: readonly Volume[] | undefined,
    backings: PodVolumeBackingMap
  ) => PodVolumeBackingMap
}
