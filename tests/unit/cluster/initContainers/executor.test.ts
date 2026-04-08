import { beforeEach, describe, expect, it } from 'vitest'
import { executeInitContainer } from '../../../../src/core/cluster/initContainers/executor'
import type { Container } from '../../../../src/core/cluster/ressources/Pod'
import {
  createFileSystem,
  type FileSystemState
} from '../../../../src/core/filesystem/FileSystem'

describe('InitContainer Executor', () => {
  let initialFileSystem: FileSystemState

  beforeEach(() => {
    const fs = createFileSystem()
    initialFileSystem = fs.toJSON()
  })

  it('returns unchanged filesystem when container has no command', () => {
    const container: Container = {
      name: 'init',
      image: 'busybox:latest'
    }

    const result = executeInitContainer(container, initialFileSystem)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toEqual(initialFileSystem)
    }
  })

  it('executes direct command/args through shared shell executor', () => {
    const container: Container = {
      name: 'init',
      image: 'busybox:latest',
      command: ['touch'],
      args: ['/config.txt']
    }

    const result = executeInitContainer(container, initialFileSystem)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const fs = createFileSystem(result.value)
      const readResult = fs.readFile('/config.txt')
      expect(readResult.ok).toBe(true)
      if (readResult.ok) {
        expect(readResult.value).toBe('')
      }
    }
  })

  it('supports sh -c script execution with chaining and echo redirection', () => {
    const container: Container = {
      name: 'init',
      image: 'busybox:latest',
      command: ['sh'],
      args: [
        '-c',
        'mkdir -p /app/data && touch /app/data/config && echo value > /app/data/setting'
      ]
    }

    const result = executeInitContainer(container, initialFileSystem)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const fs = createFileSystem(result.value)
      const configResult = fs.readFile('/app/data/config')
      expect(configResult.ok).toBe(true)

      const settingResult = fs.readFile('/app/data/setting')
      expect(settingResult.ok).toBe(true)
      if (settingResult.ok) {
        expect(settingResult.value).toBe('value')
      }
    }
  })

  it('returns invalid sh -c error when script body is missing', () => {
    const container: Container = {
      name: 'init',
      image: 'busybox:latest',
      command: ['sh'],
      args: ['-c']
    }

    const result = executeInitContainer(container, initialFileSystem)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid sh -c syntax')
    }
  })

  it('returns shell parser error for unknown command', () => {
    const container: Container = {
      name: 'init',
      image: 'busybox:latest',
      command: ['cp'],
      args: ['source', 'dest']
    }

    const result = executeInitContainer(container, initialFileSystem)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('command not found')
    }
  })
})
