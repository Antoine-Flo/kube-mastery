import { createPersistentVolumeBackingStore } from './PersistentVolumeBackingStore'

const persistentVolumeBackingStore = createPersistentVolumeBackingStore()

export const getPersistentVolumeBackingStore = () => {
  return persistentVolumeBackingStore
}

export const releasePersistentVolumeBacking = (
  persistentVolumeName: string
): void => {
  persistentVolumeBackingStore.removeIfUnused(persistentVolumeName)
}
