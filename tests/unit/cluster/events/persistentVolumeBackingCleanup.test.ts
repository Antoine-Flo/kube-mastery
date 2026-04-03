import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterStateData } from '../../../../src/core/cluster/ClusterState'
import { handlePersistentVolumeDeleted } from '../../../../src/core/cluster/events/handlers'
import { createPersistentVolumeDeletedEvent } from '../../../../src/core/cluster/events/types'
import { createPersistentVolume } from '../../../../src/core/cluster/ressources/PersistentVolume'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import {
  getPersistentVolumeBackingStore,
  releasePersistentVolumeBacking
} from '../../../../src/core/volumes/runtime'

describe('PersistentVolume backing cleanup on delete events', () => {
  const persistentVolumeName = 'pv-delete-recreate-regression'

  beforeEach(() => {
    releasePersistentVolumeBacking(persistentVolumeName)
  })

  it('should not reuse stale backing after PV delete and recreate with same name', () => {
    const backingStore = getPersistentVolumeBackingStore()
    const deletedPersistentVolume = createPersistentVolume({
      name: persistentVolumeName,
      spec: {
        capacity: { storage: '1Gi' },
        accessModes: ['ReadWriteOnce'],
        hostPath: { path: '/mnt/data/pv-delete-recreate-regression' }
      }
    })

    const oldBacking = backingStore.getOrCreate(deletedPersistentVolume)
    const oldBackingFileSystem = createFileSystem(oldBacking, undefined, {
      mutable: true
    })
    const writeStaleDataResult = oldBackingFileSystem.createFile(
      '/stale.txt',
      'old-data-from-pv1'
    )
    expect(writeStaleDataResult.ok).toBe(true)

    const state = createClusterStateData({
      persistentVolumes: [deletedPersistentVolume]
    })
    const deletedEvent = createPersistentVolumeDeletedEvent(
      persistentVolumeName,
      deletedPersistentVolume
    )
    handlePersistentVolumeDeleted(state, deletedEvent)

    const recreatedPersistentVolume = createPersistentVolume({
      name: persistentVolumeName,
      spec: {
        capacity: { storage: '1Gi' },
        accessModes: ['ReadWriteOnce'],
        hostPath: { path: '/mnt/data/pv-delete-recreate-regression' }
      }
    })
    const newBacking = backingStore.getOrCreate(recreatedPersistentVolume)
    expect(newBacking).not.toBe(oldBacking)

    const newBackingFileSystem = createFileSystem(newBacking, undefined, {
      mutable: true
    })
    const staleReadResult = newBackingFileSystem.readFile('/stale.txt')
    expect(staleReadResult.ok).toBe(false)
  })
})
