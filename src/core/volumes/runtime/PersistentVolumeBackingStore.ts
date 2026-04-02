import type { FileSystemState } from '../../filesystem/FileSystem'
import type { PersistentVolume } from '../../cluster/ressources/PersistentVolume'
import { createEmptyVolumeBacking } from './providers/sharedVolumeFileBuilder'

export interface PersistentVolumeBackingStore {
  getOrCreate: (persistentVolume: PersistentVolume) => FileSystemState
  get: (persistentVolumeName: string) => FileSystemState | undefined
  removeIfUnused: (persistentVolumeName: string) => void
}

export const createPersistentVolumeBackingStore =
  (): PersistentVolumeBackingStore => {
    const byPersistentVolumeName = new Map<string, FileSystemState>()

    const getOrCreate = (
      persistentVolume: PersistentVolume
    ): FileSystemState => {
      const existing = byPersistentVolumeName.get(
        persistentVolume.metadata.name
      )
      if (existing != null) {
        return existing
      }
      const created = createEmptyVolumeBacking()
      byPersistentVolumeName.set(persistentVolume.metadata.name, created)
      return created
    }

    const get = (persistentVolumeName: string): FileSystemState | undefined => {
      return byPersistentVolumeName.get(persistentVolumeName)
    }

    const removeIfUnused = (persistentVolumeName: string): void => {
      byPersistentVolumeName.delete(persistentVolumeName)
    }

    return {
      getOrCreate,
      get,
      removeIfUnused
    }
  }
