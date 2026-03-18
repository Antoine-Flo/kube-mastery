import { beforeEach, describe, expect, it } from 'vitest'
import type { FileSystemState } from '../../../../src/core/filesystem/FileSystem'
import { ShellContextStack } from '../../../../src/core/terminal/core/ShellContext'

describe('ShellContextStack', () => {
  let fileSystemState: FileSystemState
  let shellContextStack: ShellContextStack

  beforeEach(() => {
    // Create a minimal filesystem state for testing
    const root = {
      type: 'directory' as const,
      name: 'root',
      path: '/',
      children: new Map()
    }
    fileSystemState = {
      currentPath: '/home/kube',
      tree: root
    }
    shellContextStack = new ShellContextStack(fileSystemState)
  })

  describe('initial state', () => {
    it('should start with host context', () => {
      expect(shellContextStack.isInContainer()).toBe(false)
    })

    it('should have default prompt for /home/kube', () => {
      expect(shellContextStack.getCurrentPrompt()).toBe('~>')
    })
  })

  describe('updateCurrentPrompt', () => {
    it('should show ~ for /home/kube', () => {
      fileSystemState.currentPath = '/home/kube'
      shellContextStack.updateCurrentPrompt()
      expect(shellContextStack.getCurrentPrompt()).toBe('~>')
    })

    it('should show ~/examples for /home/kube/examples', () => {
      fileSystemState.currentPath = '/home/kube/examples'
      shellContextStack.updateCurrentPrompt()
      expect(shellContextStack.getCurrentPrompt()).toBe('~/examples>')
    })

    it('should show ~/nested/path for /home/kube/nested/path', () => {
      fileSystemState.currentPath = '/home/kube/nested/path'
      shellContextStack.updateCurrentPrompt()
      expect(shellContextStack.getCurrentPrompt()).toBe('~/nested/path>')
    })

    it('should show absolute path for paths outside /home/kube', () => {
      fileSystemState.currentPath = '/etc'
      shellContextStack.updateCurrentPrompt()
      expect(shellContextStack.getCurrentPrompt()).toBe('/etc>')
    })

    it('should show absolute path for root', () => {
      fileSystemState.currentPath = '/'
      shellContextStack.updateCurrentPrompt()
      expect(shellContextStack.getCurrentPrompt()).toBe('/>')
    })

    it('should show absolute path for /home (not /home/kube)', () => {
      fileSystemState.currentPath = '/home'
      shellContextStack.updateCurrentPrompt()
      expect(shellContextStack.getCurrentPrompt()).toBe('/home>')
    })
  })

  describe('container context', () => {
    beforeEach(() => {
      const containerFs = {
        currentPath: '/',
        tree: fileSystemState.tree
      }
      shellContextStack.pushContainerContext(
        'nginx-pod',
        'nginx',
        'default',
        containerFs
      )
    })

    it('should be in container after pushContainerContext', () => {
      expect(shellContextStack.isInContainer()).toBe(true)
    })

    it('should show container prompt for root', () => {
      expect(shellContextStack.getCurrentPrompt()).toBe('[nginx-pod:nginx] />')
    })

    it('should show container prompt with path', () => {
      // We need to modify the underlying state
      const context = shellContextStack.getCurrentContext()

      ;(context.fileSystem as any).getCurrentPath = () => '/var/log'

      shellContextStack.updateCurrentPrompt()
      expect(shellContextStack.getCurrentPrompt()).toBe(
        '[nginx-pod:nginx] /var/log>'
      )
    })

    it('should return to host context after popContext', () => {
      const result = shellContextStack.popContext()
      expect(result).toBe(true)
      expect(shellContextStack.isInContainer()).toBe(false)
      expect(shellContextStack.getCurrentPrompt()).toBe('~>')
    })

    it('should isolate container filesystem from host filesystem', () => {
      const hostFileSystem = shellContextStack.getCurrentFileSystem()
      const hostCreateResult = hostFileSystem.createFile('host.txt')
      expect(hostCreateResult.ok).toBe(true)

      const isolatedContainerFs: FileSystemState = {
        currentPath: '/',
        tree: {
          type: 'directory',
          name: 'root',
          path: '/',
          children: new Map()
        }
      }
      shellContextStack.pushContainerContext(
        'isolated-pod',
        'main',
        'default',
        isolatedContainerFs
      )

      const containerFileSystem = shellContextStack.getCurrentFileSystem()
      const containerCreateResult = containerFileSystem.createFile('container.txt')
      expect(containerCreateResult.ok).toBe(true)

      shellContextStack.popContext()

      expect(hostFileSystem.readFile('host.txt').ok).toBe(true)
      expect(hostFileSystem.readFile('container.txt').ok).toBe(false)
    })
  })

  describe('popContext', () => {
    it('should not pop the host context', () => {
      const result = shellContextStack.popContext()
      expect(result).toBe(false)
      expect(shellContextStack.isInContainer()).toBe(false)
    })
  })
})
