import { describe, expect, it } from 'vitest'
import { createDebianFileSystem } from '../../../../src/core/filesystem/debianFileSystem'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import type { Container, Volume } from '../../../../src/core/cluster/ressources/Pod'
import {
  applyVolumeMountBindingsToFileSystem,
  createEmptyDirProvider,
  createPodVolumeRuntimeManager
} from '../../../../src/core/volumes/runtime'

describe('PodVolumeRuntimeManager', () => {
  it('should create emptyDir pod backings', () => {
    const manager = createPodVolumeRuntimeManager([createEmptyDirProvider()])
    const volumes: Volume[] = [
      {
        name: 'shared',
        source: { type: 'emptyDir' }
      }
    ]

    const backings = manager.ensurePodVolumeBackings(volumes, {})

    expect(Object.keys(backings)).toEqual(['shared'])
    expect(backings.shared.tree.type).toBe('directory')
  })

  it('should share mounted emptyDir data between containers', () => {
    const manager = createPodVolumeRuntimeManager([createEmptyDirProvider()])
    const volumes: Volume[] = [
      {
        name: 'shared',
        source: { type: 'emptyDir' }
      }
    ]
    const producer: Container = {
      name: 'producer',
      image: 'busybox:1.36',
      volumeMounts: [{ name: 'shared', mountPath: '/shared' }]
    }
    const consumer: Container = {
      name: 'consumer',
      image: 'busybox:1.36',
      volumeMounts: [{ name: 'shared', mountPath: '/shared' }]
    }

    const backings = manager.ensurePodVolumeBackings(volumes, {})
    const producerRoot = createDebianFileSystem({
      hostname: 'emptydir-demo',
      resolvConf: 'nameserver 10.96.0.10'
    })
    const consumerRoot = createDebianFileSystem({
      hostname: 'emptydir-demo',
      resolvConf: 'nameserver 10.96.0.10'
    })

    const producerBindings = manager.buildContainerMountBindings(
      producer,
      volumes,
      backings
    )
    const consumerBindings = manager.buildContainerMountBindings(
      consumer,
      volumes,
      backings
    )
    applyVolumeMountBindingsToFileSystem(producerRoot, producerBindings)
    applyVolumeMountBindingsToFileSystem(consumerRoot, consumerBindings)

    const producerFileSystem = createFileSystem(producerRoot, undefined, {
      mutable: true
    })
    const consumerFileSystem = createFileSystem(consumerRoot, undefined, {
      mutable: true
    })
    const createFileResult = producerFileSystem.createFile('/shared/message.txt', '')
    expect(createFileResult.ok).toBe(true)
    expect(consumerFileSystem.readFile('/shared/message.txt').ok).toBe(true)
  })
})
