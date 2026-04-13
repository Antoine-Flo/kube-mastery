import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import type { ApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import type { FileSystem } from '../../../../src/core/shell/commands'
import { createCommandDispatcher } from '../../../../src/core/terminal/core/CommandDispatcher'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import { ShellContextStack } from '../../../../src/core/terminal/core/ShellContext'
import { createMockRenderer } from '../../helpers/mockRenderer'
import { createLogger } from '../../../../src/logger/Logger'
import type { Logger } from '../../../../src/logger/Logger'
import { initializeSimNetworkRuntime } from '../../../../src/core/network/SimNetworkRuntime'
import type { SimNetworkRuntime } from '../../../../src/core/network/SimNetworkRuntime'

describe('CommandDispatcher', () => {
  let fileSystem: FileSystem
  let renderer: ReturnType<typeof createMockRenderer>
  let shellContextStack: ShellContextStack
  let dispatcher: ReturnType<typeof createCommandDispatcher>
  let apiServer: ApiServerFacade
  let networkRuntime: SimNetworkRuntime
  let logger: Logger

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
    fileSystem = createFileSystem(fileSystemState, undefined, { mutable: true })
    renderer = createMockRenderer()

    // Créer les dépendances kubectl
    logger = createLogger()
    const eventBus = createEventBus()
    apiServer = createApiServerFacade({ eventBus })
    networkRuntime = initializeSimNetworkRuntime(apiServer)

    dispatcher = createCommandDispatcher({
      fileSystem,
      renderer,
      shellContextStack,
      apiServer,
      networkRuntime,
      logger
    })
  })

  describe('Shell commands', () => {
    it('should execute pwd command', () => {
      const result = dispatcher.execute('pwd')
      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('/home/kube')
    })

    it('should execute ls command', () => {
      const result = dispatcher.execute('ls')
      expect(result.ok).toBe(true)
    })

    it('should execute cd command and update prompt', () => {
      // Créer un répertoire d'abord
      const createResult = fileSystem.createDirectory('test')
      expect(createResult.ok).toBe(true)

      const cdResult = fileSystem.changeDirectory('test')
      expect(cdResult.ok).toBe(true)

      // Revenir au répertoire de base
      const result = dispatcher.execute('cd /home/kube')
      expect(result.ok).toBe(true)
    })

    it('should execute clear command', () => {
      const result = dispatcher.execute('clear')
      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toBe('')
    })

    it('should execute help command', () => {
      const result = dispatcher.execute('help')
      expect(result.ok).toBe(true)
    })

    it('should handle command with flags', () => {
      const result = dispatcher.execute('ls -l')
      expect(result.ok).toBe(true)
    })

    it('should handle command with arguments', () => {
      // Créer un fichier d'abord avec du contenu
      const createResult = fileSystem.createFile('test.txt')
      expect(createResult.ok).toBe(true)
      const writeResult = fileSystem.writeFile('test.txt', 'test content')
      expect(writeResult.ok).toBe(true)

      const result = dispatcher.execute('cat test.txt')
      expect(result.ok).toBe(true)
    })
  })

  describe('Kubectl commands', () => {
    it('should handle kubectl get pods command', () => {
      const result = dispatcher.execute('kubectl get pods')
      expect(result.ok).toBe(true)
      // Cluster vide, pas de pods
      expect(renderer.getOutput()).toContain(
        'No resources found in default namespace.'
      )
    })

    it('should handle kubectl describe with non-existent resource', () => {
      const result = dispatcher.execute('kubectl describe pod my-pod')
      expect(result.ok).toBe(false)
      // Pod n'existe pas
      expect(renderer.getOutput()).toContain('not found')
    })

    it('should support kubectl output redirection to file', () => {
      const result = dispatcher.execute(
        'kubectl run mypod --image=nginx --dry-run=client -o yaml > pod.yaml'
      )
      expect(result.ok).toBe(true)

      const fileResult = fileSystem.readFile('pod.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('apiVersion: v1')
      expect(fileResult.value).toContain('kind: Pod')
      expect(fileResult.value).toContain('name: mypod')

      expect(renderer.getOutput()).toBe('')
    })

    it('should support create deployment dry-run yaml redirection', () => {
      const result = dispatcher.execute(
        'kubectl create deployment myapp --image=nginx --replicas=3 --dry-run=client -o yaml > deployment.yaml'
      )
      expect(result.ok).toBe(true)

      const fileResult = fileSystem.readFile('deployment.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Deployment')
      expect(fileResult.value).toContain('name: myapp')
      expect(fileResult.value).toContain('replicas: 3')
      expect(fileResult.value).toContain('status: {}')
    })

    it('should support create service dry-run yaml redirection', () => {
      const result = dispatcher.execute(
        'kubectl create service nodeport my-svc --tcp=80:8080 --node-port=30080 --dry-run=client -o yaml > service.yaml'
      )
      expect(result.ok).toBe(true)

      const fileResult = fileSystem.readFile('service.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Service')
      expect(fileResult.value).toContain('name: my-svc')
      expect(fileResult.value).toContain('type: NodePort')
      expect(fileResult.value).toContain('nodePort: 30080')
      expect(fileResult.value).toContain('name: 80-8080')
      expect(fileResult.value).toContain('loadBalancer: {}')
    })

    it('should support create configmap dry-run yaml redirection', () => {
      const result = dispatcher.execute(
        'kubectl create configmap app-config --from-literal=LOG_LEVEL=info --dry-run=client -o yaml > app-config.yaml'
      )
      expect(result.ok).toBe(true)

      const fileResult = fileSystem.readFile('app-config.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: ConfigMap')
      expect(fileResult.value).toContain('name: app-config')
      expect(fileResult.value).toContain('LOG_LEVEL: info')
    })

    it('should support create secret generic dry-run yaml redirection', () => {
      const result = dispatcher.execute(
        'kubectl create secret generic mysecret --from-literal=password=s3cr3t --dry-run=client -o yaml > mysecret.yaml'
      )
      expect(result.ok).toBe(true)

      const fileResult = fileSystem.readFile('mysecret.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Secret')
      expect(fileResult.value).toContain('name: mysecret')
      expect(fileResult.value).not.toContain('type: Opaque')
    })

    it('should support create secret tls dry-run yaml redirection', () => {
      fileSystem.createFile('tls.crt')
      fileSystem.writeFile('tls.crt', 'CERTDATA')
      fileSystem.createFile('tls.key')
      fileSystem.writeFile('tls.key', 'KEYDATA')

      const result = dispatcher.execute(
        'kubectl create secret tls tls-secret --cert=tls.crt --key=tls.key --dry-run=client -o yaml > tls-secret.yaml'
      )
      expect(result.ok).toBe(true)

      const fileResult = fileSystem.readFile('tls-secret.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Secret')
      expect(fileResult.value).toContain('name: tls-secret')
      expect(fileResult.value).toContain('type: kubernetes.io/tls')
    })

    it('should support create secret docker-registry dry-run yaml redirection', () => {
      const result = dispatcher.execute(
        'kubectl create secret docker-registry regcred --docker-server=docker.io --docker-username=alice --docker-password=s3cr3t --dry-run=client -o yaml > regcred.yaml'
      )
      expect(result.ok).toBe(true)

      const fileResult = fileSystem.readFile('regcred.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Secret')
      expect(fileResult.value).toContain('name: regcred')
      expect(fileResult.value).toContain('type: kubernetes.io/dockerconfigjson')
    })
  })

  describe('Error handling', () => {
    it('should return error for unknown command', () => {
      const result = dispatcher.execute('unknown-command')
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain('Unknown command: unknown-command')
    })

    it('should display error message for invalid shell command', () => {
      dispatcher.execute('ls /invalid/path')
      // Le résultat dépend de l'implémentation, mais l'erreur doit être affichée
      expect(renderer.getOutput()).toBeTruthy()
    })
  })

  describe('Command routing', () => {
    it('should route shell commands to ShellCommandHandler', () => {
      const result = dispatcher.execute('pwd')
      expect(result.ok).toBe(true)
      // Vérifier que c'est bien géré par le shell handler
      expect(renderer.getOutput()).toContain('/home/kube')
    })

    it('should route kubectl commands to KubectlCommandHandler', () => {
      const result = dispatcher.execute('kubectl get pods')
      expect(result.ok).toBe(true)
      // kubectl retourne un vrai résultat maintenant
      expect(renderer.getOutput()).toContain('No resources found')
    })
  })

  describe('Dispatcher controls', () => {
    it('returns Input locked when input is locked', () => {
      const lockedDispatcher = createCommandDispatcher({
        fileSystem,
        renderer,
        shellContextStack,
        apiServer,
        networkRuntime,
        logger,
        isInputLocked: () => true
      })
      const result = lockedDispatcher.execute('pwd')
      expect(result.ok).toBe(false)
      if (result.ok) {
        return
      }
      expect(result.error).toBe('Input locked')
    })

    it('locks input and prints message at command limit', () => {
      const lockInput = vi.fn()
      const unlockInput = vi.fn()
      const limitedDispatcher = createCommandDispatcher({
        fileSystem,
        renderer,
        shellContextStack,
        apiServer,
        networkRuntime,
        logger,
        commandLimit: 1,
        commandLimitMessage: 'exercise complete',
        lockInput,
        unlockInput
      })

      const result = limitedDispatcher.execute('pwd')
      expect(result.ok).toBe(true)
      expect(lockInput).toHaveBeenCalled()
      expect(unlockInput).toHaveBeenCalled()
      expect(renderer.getOutput()).toContain('exercise complete')
    })

    it('stops active streams and unlocks input', () => {
      const unlockInput = vi.fn()
      const streamingDispatcher = createCommandDispatcher({
        fileSystem,
        renderer,
        shellContextStack,
        apiServer,
        networkRuntime,
        logger,
        unlockInput
      })

      apiServer.createResource(
        'Pod',
        createPod({
          name: 'log-stream',
          namespace: 'default',
          containers: [{ name: 'app', image: 'nginx' }]
        })
      )
      const streamResult = streamingDispatcher.execute(
        'kubectl logs -f log-stream'
      )
      expect(streamResult.ok).toBe(true)
      expect(streamingDispatcher.hasActiveStream()).toBe(true)

      streamingDispatcher.stopActiveStream()
      expect(unlockInput).toHaveBeenCalled()
      expect(streamingDispatcher.hasActiveStream()).toBe(false)
    })
  })
})
