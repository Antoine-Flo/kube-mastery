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
    // Create a fresh filesystem for each test
    const fs = createFileSystem()
    initialFileSystem = fs.toJSON()
  })

  describe('no-op behavior', () => {
    it('should return unchanged filesystem when container has no command', () => {
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

    it('should return unchanged filesystem when command array is empty', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: []
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual(initialFileSystem)
      }
    })
  })

  describe('touch command', () => {
    it('should create empty file with touch command', () => {
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

    it('should create file at relative path (normalized to absolute)', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['touch'],
        args: ['file.txt']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)
        const readResult = fs.readFile('/file.txt')
        expect(readResult.ok).toBe(true)
      }
    })
  })

  describe('mkdir command', () => {
    it('should create directory with mkdir', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['mkdir'],
        args: ['/data']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)
        const listResult = fs.listDirectory('/data')
        expect(listResult.ok).toBe(true)
      }
    })

    it('should create nested directories with mkdir -p', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['mkdir'],
        args: ['-p', '/app/config/secrets']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)
        const listResult = fs.listDirectory('/app/config/secrets')
        expect(listResult.ok).toBe(true)
      }
    })

    it('should return error when mkdir has missing operand', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['mkdir'],
        args: ['-p'] // -p flag but no path
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('missing operand')
      }
    })
  })

  describe('echo redirect command', () => {
    it('should create file with content using echo redirect', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'echo "hello world" > /greeting.txt']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)
        const readResult = fs.readFile('/greeting.txt')
        expect(readResult.ok).toBe(true)
        if (readResult.ok) {
          expect(readResult.value).toBe('hello world')
        }
      }
    })

    it('should handle echo without quotes', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'echo content > /file.txt']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)
        const readResult = fs.readFile('/file.txt')
        expect(readResult.ok).toBe(true)
        if (readResult.ok) {
          expect(readResult.value).toBe('content')
        }
      }
    })

    it('should return error for invalid echo redirect syntax', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'echo'] // echo without redirect
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBeTruthy()
      }
    })
  })

  describe('sh -c command', () => {
    it('should execute script with sh -c', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'touch /ready']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)
        const readResult = fs.readFile('/ready')
        expect(readResult.ok).toBe(true)
      }
    })

    it('should return error for invalid sh -c syntax (missing script)', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c'] // -c without script
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid sh -c syntax')
      }
    })

    it('should return error when sh has no args', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh']
        // no args - treated as unsupported command since no -c flag
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Unsupported command')
      }
    })
  })

  describe('chained commands with &&', () => {
    it('should execute multiple commands chained with &&', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'mkdir /app && touch /app/ready']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)

        const dirResult = fs.listDirectory('/app')
        expect(dirResult.ok).toBe(true)

        const fileResult = fs.readFile('/app/ready')
        expect(fileResult.ok).toBe(true)
      }
    })

    it('should stop execution on first error in chain', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'invalidcmd && touch /ready']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Unsupported command')
      }
    })

    it('should execute three commands in chain', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: [
          '-c',
          'mkdir -p /app/data && touch /app/data/config && echo "value" > /app/data/setting'
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
  })

  describe('unsupported commands', () => {
    it('should return error for unsupported command', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['cp'],
        args: ['source', 'dest']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Unsupported command')
        expect(result.error).toContain('cp')
      }
    })

    it('should return error for unknown command in sh -c', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'wget http://example.com']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Unsupported command')
      }
    })
  })

  describe('path normalization', () => {
    it('should normalize relative path to absolute', () => {
      const container: Container = {
        name: 'init',
        image: 'busybox:latest',
        command: ['sh'],
        args: ['-c', 'mkdir data']
      }

      const result = executeInitContainer(container, initialFileSystem)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const fs = createFileSystem(result.value)
        const listResult = fs.listDirectory('/data')
        expect(listResult.ok).toBe(true)
      }
    })
  })
})
