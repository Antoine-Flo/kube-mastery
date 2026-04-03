import { describe, expect, it } from 'vitest'
import { createDebianFileSystem } from '../../../../src/core/filesystem/debianFileSystem'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import type {
  Container,
  Volume
} from '../../../../src/core/cluster/ressources/Pod'
import {
  applyVolumeMountBindingsToFileSystem,
  createEmptyDirProvider,
  createPodVolumeRuntimeManager
} from '../../../../src/core/volumes/runtime'

const createMountedFileSystem = (readOnly: boolean) => {
  const manager = createPodVolumeRuntimeManager([createEmptyDirProvider()])
  const volumes: Volume[] = [
    {
      name: 'shared',
      source: { type: 'emptyDir' }
    }
  ]
  const container: Container = {
    name: 'app',
    image: 'busybox:1.36',
    volumeMounts: [{ name: 'shared', mountPath: '/shared', readOnly }]
  }

  const backings = manager.ensurePodVolumeBackings(volumes, {})
  const backingFileSystem = createFileSystem(backings.shared, undefined, {
    mutable: true
  })
  const seedResult = backingFileSystem.createFile('/seed.txt', 'seed')
  expect(seedResult.ok).toBe(true)

  const rootFileSystem = createDebianFileSystem()
  const bindings = manager.buildContainerMountBindings(container, volumes, backings)
  applyVolumeMountBindingsToFileSystem(rootFileSystem, bindings)

  return createFileSystem(rootFileSystem, undefined, { mutable: true })
}

describe('ReadOnly mount enforcement', () => {
  it('should prevent writes to volumes mounted with readOnly: true', () => {
    const fileSystem = createMountedFileSystem(true)

    const createFileResult = fileSystem.createFile('/shared/new.txt', '')
    expect(createFileResult.ok).toBe(false)
    if (!createFileResult.ok) {
      expect(createFileResult.error).toContain('Read-only file system')
    }

    const writeFileResult = fileSystem.writeFile('/shared/seed.txt', 'updated')
    expect(writeFileResult.ok).toBe(false)
    if (!writeFileResult.ok) {
      expect(writeFileResult.error).toContain('Read-only file system')
    }

    const deleteFileResult = fileSystem.deleteFile('/shared/seed.txt')
    expect(deleteFileResult.ok).toBe(false)
    if (!deleteFileResult.ok) {
      expect(deleteFileResult.error).toContain('Read-only file system')
    }

    const createDirectoryResult = fileSystem.createDirectory('/shared/new-dir')
    expect(createDirectoryResult.ok).toBe(false)
    if (!createDirectoryResult.ok) {
      expect(createDirectoryResult.error).toContain('Read-only file system')
    }
  })

  it('should allow writes to volumes mounted with readOnly: false', () => {
    const fileSystem = createMountedFileSystem(false)

    expect(fileSystem.createFile('/shared/new.txt', '').ok).toBe(true)
    expect(fileSystem.writeFile('/shared/seed.txt', 'updated').ok).toBe(true)
    expect(fileSystem.deleteFile('/shared/seed.txt').ok).toBe(true)
    expect(fileSystem.createDirectory('/shared/new-dir').ok).toBe(true)
  })

  it('should still allow writes outside readOnly mount paths', () => {
    const fileSystem = createMountedFileSystem(true)
    const writeOutsideResult = fileSystem.createFile('/tmp/outside.txt', 'ok')
    expect(writeOutsideResult.ok).toBe(true)
  })
})
