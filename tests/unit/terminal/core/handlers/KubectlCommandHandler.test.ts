import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import type { CommandContext } from '../../../../../src/core/terminal/core/CommandContext'
import { createFileSystem } from '../../../../../src/core/filesystem/FileSystem'
import { KubectlCommandHandler } from '../../../../../src/core/terminal/core/handlers/KubectlCommandHandler'
import { ShellContextStack } from '../../../../../src/core/terminal/core/ShellContext'
import { createTerminalOutput } from '../../../../../src/core/terminal/core/TerminalOutput'
import { createMockRenderer } from '../../../helpers/mockRenderer'
import { createLogger } from '../../../../../src/logger/Logger'

describe('KubectlCommandHandler', () => {
  let handler: KubectlCommandHandler
  let context: CommandContext
  let renderer: ReturnType<typeof createMockRenderer>

  beforeEach(() => {
    // Créer la structure de base /home/kube dans l'arbre
    const homeDir = {
      type: 'directory' as const,
      name: 'home',
      path: '/home',
      children: new Map(),
      createdAt: '',
      modifiedAt: ''
    }
    const kubeDir = {
      type: 'directory' as const,
      name: 'kube',
      path: '/home/kube',
      children: new Map(),
      createdAt: '',
      modifiedAt: ''
    }
    homeDir.children.set('kube', kubeDir)

    const root = {
      type: 'directory' as const,
      name: 'root',
      path: '/',
      children: new Map([['home', homeDir]]),
      createdAt: '',
      modifiedAt: ''
    }

    const fileSystemState = {
      currentPath: '/home/kube',
      tree: root
    }

    const shellContextStack = new ShellContextStack(fileSystemState)
    const fileSystem = createFileSystem(fileSystemState, undefined, {
      mutable: true
    })
    renderer = createMockRenderer()
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const logger = createLogger()

    context = {
      fileSystem,
      renderer,
      output: createTerminalOutput(renderer),
      shellContextStack,
      clusterState,
      logger,
      eventBus
    }

    handler = new KubectlCommandHandler()
  })

  describe('canHandle', () => {
    it('should return true for kubectl commands', () => {
      expect(handler.canHandle('kubectl get pods')).toBe(true)
      expect(handler.canHandle('kubectl describe pod my-pod')).toBe(true)
      expect(handler.canHandle('kubectl apply -f file.yaml')).toBe(true)
      expect(handler.canHandle('kubectl logs my-pod')).toBe(true)
      expect(handler.canHandle('kubectl exec -it my-pod -- /bin/sh')).toBe(true)
    })

    it('should return true even with leading spaces', () => {
      expect(handler.canHandle('  kubectl get pods')).toBe(true)
    })

    it('should return false for non-kubectl commands', () => {
      expect(handler.canHandle('pwd')).toBe(false)
      expect(handler.canHandle('ls')).toBe(false)
      expect(handler.canHandle('cd /home')).toBe(false)
      expect(handler.canHandle('kubect')).toBe(false)
      expect(handler.canHandle('kubectlget')).toBe(false)
    })

    it('should return false for empty command', () => {
      expect(handler.canHandle('')).toBe(false)
    })
  })

  describe('execute', () => {
    it('should execute kubectl get pods and return success', () => {
      const result = handler.execute('kubectl get pods', context)
      expect(result.ok).toBe(true)
    })

    it('should return error for unknown resource', () => {
      const result = handler.execute('kubectl describe pod my-pod', context)
      // Pod doesn't exist in empty cluster
      expect(result.ok).toBe(false)
    })

    it('should return success for valid get command', () => {
      const result = handler.execute('kubectl get pods', context)
      expect(result.ok).toBe(true)
    })
  })
})
