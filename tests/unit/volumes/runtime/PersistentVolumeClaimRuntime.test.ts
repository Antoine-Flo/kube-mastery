import { describe, expect, it } from 'vitest'
import { createPersistentVolume } from '../../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../../src/core/cluster/ressources/PersistentVolumeClaim'
import type { Container, Volume } from '../../../../src/core/cluster/ressources/Pod'
import { createDebianFileSystem } from '../../../../src/core/filesystem/debianFileSystem'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import {
  applyVolumeMountBindingsToFileSystem,
  createPersistentVolumeBackingStore,
  createPersistentVolumeClaimProvider,
  createPodVolumeRuntimeManager
} from '../../../../src/core/volumes/runtime'

describe('PersistentVolumeClaim volume provider', () => {
  it('should resolve claim to bound persistent volume backing', () => {
    const backingStore = createPersistentVolumeBackingStore()
    const manager = createPodVolumeRuntimeManager([
      createPersistentVolumeClaimProvider(backingStore)
    ])
    const persistentVolume = createPersistentVolume({
      name: 'pv-lab',
      spec: {
        capacity: { storage: '1Gi' },
        accessModes: ['ReadWriteOnce'],
        hostPath: { path: '/mnt/data/pv-lab' }
      }
    })
    const claim = createPersistentVolumeClaim({
      name: 'lab-claim',
      namespace: 'default',
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } },
        volumeName: 'pv-lab'
      }
    })
    const volumes: Volume[] = [
      {
        name: 'data',
        source: { type: 'persistentVolumeClaim', claimName: 'lab-claim' }
      }
    ]

    const backings = manager.ensurePodVolumeBackings(volumes, {}, {
      namespace: 'default',
      findPersistentVolumeClaim: (name, namespace) => {
        if (name === claim.metadata.name && namespace === claim.metadata.namespace) {
          return claim
        }
        return undefined
      },
      findPersistentVolume: (name) => {
        if (name === persistentVolume.metadata.name) {
          return persistentVolume
        }
        return undefined
      }
    })
    const pvBacking = backingStore.get('pv-lab')
    expect(pvBacking).toBeDefined()
    expect(backings.data).toBe(pvBacking)
  })

  it('should share claim data across pod mounts', () => {
    const backingStore = createPersistentVolumeBackingStore()
    const manager = createPodVolumeRuntimeManager([
      createPersistentVolumeClaimProvider(backingStore)
    ])
    const persistentVolume = createPersistentVolume({
      name: 'pv-shared',
      spec: {
        capacity: { storage: '1Gi' },
        accessModes: ['ReadWriteOnce'],
        hostPath: { path: '/mnt/data/pv-shared' }
      }
    })
    const claim = createPersistentVolumeClaim({
      name: 'shared-claim',
      namespace: 'default',
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } },
        volumeName: 'pv-shared'
      }
    })
    const volumes: Volume[] = [
      {
        name: 'data',
        source: { type: 'persistentVolumeClaim', claimName: 'shared-claim' }
      }
    ]
    const writer: Container = {
      name: 'writer',
      image: 'busybox:1.36',
      volumeMounts: [{ name: 'data', mountPath: '/data' }]
    }
    const reader: Container = {
      name: 'reader',
      image: 'busybox:1.36',
      volumeMounts: [{ name: 'data', mountPath: '/data' }]
    }
    const context = {
      namespace: 'default',
      findPersistentVolumeClaim: (name: string, namespace: string) => {
        if (name === claim.metadata.name && namespace === claim.metadata.namespace) {
          return claim
        }
        return undefined
      },
      findPersistentVolume: (name: string) => {
        if (name === persistentVolume.metadata.name) {
          return persistentVolume
        }
        return undefined
      }
    }
    const writerBackings = manager.ensurePodVolumeBackings(volumes, {}, context)
    const readerBackings = manager.ensurePodVolumeBackings(volumes, {}, context)
    expect(writerBackings.data).toBe(readerBackings.data)

    const writerRoot = createDebianFileSystem({
      hostname: 'writer-pod',
      resolvConf: 'nameserver 10.96.0.10'
    })
    const readerRoot = createDebianFileSystem({
      hostname: 'reader-pod',
      resolvConf: 'nameserver 10.96.0.10'
    })
    const writerBindings = manager.buildContainerMountBindings(
      writer,
      volumes,
      writerBackings
    )
    const readerBindings = manager.buildContainerMountBindings(
      reader,
      volumes,
      readerBackings
    )
    applyVolumeMountBindingsToFileSystem(writerRoot, writerBindings)
    applyVolumeMountBindingsToFileSystem(readerRoot, readerBindings)

    const writerFileSystem = createFileSystem(writerRoot, undefined, { mutable: true })
    const readerFileSystem = createFileSystem(readerRoot, undefined, { mutable: true })
    const createResult = writerFileSystem.createFile('/data/record.txt', 'saved')
    expect(createResult.ok).toBe(true)
    const readResult = readerFileSystem.readFile('/data/record.txt')
    expect(readResult.ok).toBe(true)
    if (!readResult.ok) {
      return
    }
    expect(readResult.value).toBe('saved')
  })
})
