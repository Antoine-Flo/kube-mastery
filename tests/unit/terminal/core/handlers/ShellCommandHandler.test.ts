import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import {
  createSecret,
  encodeBase64
} from '../../../../../src/core/cluster/ressources/Secret'
import type { CommandContext } from '../../../../../src/core/terminal/core/CommandContext'
import { createFileSystem } from '../../../../../src/core/filesystem/FileSystem'
import { ShellCommandHandler } from '../../../../../src/core/terminal/core/handlers/ShellCommandHandler'
import { ShellContextStack } from '../../../../../src/core/terminal/core/ShellContext'
import { createTerminalOutput } from '../../../../../src/core/terminal/core/TerminalOutput'
import { createMockRenderer } from '../../../helpers/mockRenderer'
import { createLogger } from '../../../../../src/logger/Logger'
import { initializeSimNetworkRuntime } from '../../../../../src/core/network/SimNetworkRuntime'

describe('ShellCommandHandler', () => {
  let handler: ShellCommandHandler
  let context: CommandContext
  let renderer: ReturnType<typeof createMockRenderer>
  let shellContextStack: ShellContextStack

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

    shellContextStack = new ShellContextStack(fileSystemState)
    const fileSystem = createFileSystem(fileSystemState, undefined, {
      mutable: true
    })
    renderer = createMockRenderer()
    const eventBus = createEventBus()
    const apiServer = createApiServerFacade({ eventBus })
    const networkRuntime = initializeSimNetworkRuntime(apiServer)
    const logger = createLogger()

    context = {
      fileSystem,
      renderer,
      output: createTerminalOutput(renderer),
      shellContextStack,
      apiServer,
      networkRuntime,
      logger
    }

    handler = new ShellCommandHandler()
  })

  afterEach(() => {
    context.networkRuntime.controller.stop()
  })

  describe('canHandle', () => {
    it('should return true for valid shell commands', () => {
      expect(handler.canHandle('pwd')).toBe(true)
      expect(handler.canHandle('ls')).toBe(true)
      expect(handler.canHandle('cd /home')).toBe(true)
      expect(handler.canHandle('cat file.txt')).toBe(true)
      expect(handler.canHandle('mkdir test')).toBe(true)
      expect(handler.canHandle('touch file.txt')).toBe(true)
      expect(handler.canHandle('rm file.txt')).toBe(true)
      expect(handler.canHandle('clear')).toBe(true)
      expect(handler.canHandle('help')).toBe(true)
      expect(handler.canHandle('env')).toBe(true)
      expect(handler.canHandle('nano file.txt')).toBe(true)
    })

    it('should return false for invalid commands', () => {
      expect(handler.canHandle('kubectl get pods')).toBe(false)
      expect(handler.canHandle('unknown-command')).toBe(false)
      expect(handler.canHandle('')).toBe(false)
    })

    it('should return true for commands with flags (parser accepts all flags)', () => {
      // Le parser accepte tous les flags, même s'ils ne sont pas reconnus par la commande
      // C'est le comportement shell standard
      expect(handler.canHandle('ls -invalid-flag')).toBe(true)
    })
  })

  describe('execute', () => {
    it('should execute pwd command', () => {
      const result = handler.execute('pwd', context)
      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('/home/kube')
    })

    it('should execute ls command', () => {
      const result = handler.execute('ls', context)
      expect(result.ok).toBe(true)
    })

    it('should execute cd command and update prompt', () => {
      // Créer un répertoire d'abord
      context.fileSystem.createDirectory('test')
      context.fileSystem.changeDirectory('test')

      const result = handler.execute('cd /home/kube', context)
      expect(result.ok).toBe(true)
      // Le prompt doit être mis à jour
      expect(shellContextStack.getCurrentFileSystem().getCurrentPath()).toBe(
        '/home/kube'
      )
    })

    it('should execute clear command and clear terminal', () => {
      const result = handler.execute('clear', context)
      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('\x1b[2J\x1b[H')
    })

    it('should execute help command', () => {
      const result = handler.execute('help', context)
      expect(result.ok).toBe(true)
      expect(renderer.getOutput().length).toBeGreaterThan(0)
    })

    it('should execute env command in host shell', () => {
      const result = handler.execute('env', context)
      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('HOME=/home/kube')
    })

    it('should accept sleep command in terminal shell', () => {
      const result = handler.execute('sleep 1', context)
      expect(result.ok).toBe(true)
    })

    it('should resolve configmap and secret env values in container shell', () => {
      const configMapCreateResult = context.apiServer.createResource(
        'ConfigMap',
        createConfigMap({
          name: 'web-config',
          namespace: 'default',
          data: {
            APP_ENV: 'crash-course'
          }
        })
      )
      expect(configMapCreateResult.ok).toBe(true)

      const secretCreateResult = context.apiServer.createResource(
        'Secret',
        createSecret({
          name: 'web-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: {
            API_TOKEN: encodeBase64('super-secret-token')
          }
        })
      )
      expect(secretCreateResult.ok).toBe(true)

      const pod = createPod({
        name: 'env-pod',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'busybox:1.36',
            env: [
              {
                name: 'APP_ENV',
                source: {
                  type: 'configMapKeyRef',
                  name: 'web-config',
                  key: 'APP_ENV'
                }
              },
              {
                name: 'API_TOKEN',
                source: {
                  type: 'secretKeyRef',
                  name: 'web-secret',
                  key: 'API_TOKEN'
                }
              }
            ]
          }
        ]
      })
      const podCreateResult = context.apiServer.createResource('Pod', pod)
      expect(podCreateResult.ok).toBe(true)

      const containerFileSystem = pod._simulator.containers.app.fileSystem
      shellContextStack.pushContainerContext(
        'env-pod',
        'app',
        'default',
        containerFileSystem
      )

      const result = handler.execute('env', context)
      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('APP_ENV=crash-course')
      expect(renderer.getOutput()).toContain('API_TOKEN=super-secret-token')
    })

    it('should return network runtime error for curl when network is unavailable', () => {
      const contextWithoutNetwork: CommandContext = {
        ...context,
        networkRuntime: undefined as unknown as CommandContext['networkRuntime']
      }
      const result = handler.execute(
        'curl svc.default.svc.cluster.local',
        contextWithoutNetwork
      )
      expect(result.ok).toBe(false)
      if (result.ok) {
        return
      }
      expect(result.error).toContain('network runtime is not available')
      expect(renderer.getOutput()).toContain('network runtime is not available')
    })

    it('should return not found when env is requested in stale container context', () => {
      const containerFsState = {
        currentPath: '/',
        tree: {
          type: 'directory' as const,
          name: 'root',
          path: '/',
          children: new Map(),
          createdAt: '',
          modifiedAt: ''
        }
      }
      shellContextStack.pushContainerContext(
        'missing-pod',
        'main',
        'default',
        containerFsState
      )
      const result = handler.execute('env', context)
      expect(result.ok).toBe(false)
      if (result.ok) {
        return
      }
      expect(result.error).toContain('pods "missing-pod" not found')
      expect(renderer.getOutput()).toContain('pods "missing-pod" not found')
    })

    it('should handle commands with flags', () => {
      const result = handler.execute('ls -l', context)
      expect(result.ok).toBe(true)
    })

    it('should handle commands with arguments', () => {
      context.fileSystem.createFile('test.txt')
      const result = handler.execute('cat test.txt', context)
      expect(result.ok).toBe(true)
    })

    it('should return error for invalid command', () => {
      // canHandle retourne false pour les commandes invalides, donc execute n'est pas appelé
      // Mais si on force l'exécution, le parser retourne une erreur
      const result = handler.execute('invalid-command', context)
      expect(result.ok).toBe(false)
      // L'erreur est affichée dans le renderer
      expect(renderer.getOutput()).toContain('command not found: invalid-command')
    })

    it('should display error message when command fails', () => {
      const result = handler.execute('cd /invalid/path', context)
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain(
        'cd: /invalid/path: No such file or directory'
      )
    })

    it('should not update prompt for non-cd commands', () => {
      const initialPath = shellContextStack
        .getCurrentFileSystem()
        .getCurrentPath()
      handler.execute('pwd', context)
      expect(shellContextStack.getCurrentFileSystem().getCurrentPath()).toBe(
        initialPath
      )
    })
  })
})
