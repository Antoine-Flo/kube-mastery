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

    it('should redirect kubectl output to a file', () => {
      const result = handler.execute(
        'kubectl run mypod --image=nginx --dry-run=client -o yaml > pod.yaml',
        context
      )
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const output = renderer.getOutput()
      expect(output).toBe('')

      const fileResult = context.fileSystem.readFile('pod.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('apiVersion: v1')
      expect(fileResult.value).toContain('kind: Pod')
      expect(fileResult.value).toContain('name: mypod')
    })

    it('should redirect create deployment dry-run yaml output to a file', () => {
      const result = handler.execute(
        'kubectl create deployment myapp --image=nginx --replicas=3 --dry-run=client -o yaml > deployment.yaml',
        context
      )
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const fileResult = context.fileSystem.readFile('deployment.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Deployment')
      expect(fileResult.value).toContain('name: myapp')
      expect(fileResult.value).toContain('replicas: 3')
      expect(fileResult.value).toContain('status: {}')
      expect(fileResult.value).not.toContain('readyReplicas: 0')

      const deployment = context.clusterState.findDeployment('myapp', 'default')
      expect(deployment.ok).toBe(false)
    })

    it('should redirect create service dry-run yaml output to a file', () => {
      const result = handler.execute(
        'kubectl create service nodeport my-svc --tcp=80:8080 --node-port=30080 --dry-run=client -o yaml > service.yaml',
        context
      )
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const fileResult = context.fileSystem.readFile('service.yaml')
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

      const service = context.clusterState.findService('my-svc', 'default')
      expect(service.ok).toBe(false)
    })

    it('should redirect create configmap dry-run yaml output to a file', () => {
      const result = handler.execute(
        'kubectl create configmap app-config --from-literal=LOG_LEVEL=info --dry-run=client -o yaml > app-config.yaml',
        context
      )
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const fileResult = context.fileSystem.readFile('app-config.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: ConfigMap')
      expect(fileResult.value).toContain('name: app-config')
      expect(fileResult.value).toContain('LOG_LEVEL: info')
    })

    it('should redirect create secret generic dry-run yaml output to a file', () => {
      const result = handler.execute(
        'kubectl create secret generic mysecret --from-literal=password=s3cr3t --dry-run=client -o yaml > mysecret.yaml',
        context
      )
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const fileResult = context.fileSystem.readFile('mysecret.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Secret')
      expect(fileResult.value).toContain('name: mysecret')
      expect(fileResult.value).not.toContain('type: Opaque')
    })

    it('should redirect create secret tls dry-run yaml output to a file', () => {
      context.fileSystem.createFile('tls.crt')
      context.fileSystem.writeFile('tls.crt', 'CERTDATA')
      context.fileSystem.createFile('tls.key')
      context.fileSystem.writeFile('tls.key', 'KEYDATA')

      const result = handler.execute(
        'kubectl create secret tls tls-secret --cert=tls.crt --key=tls.key --dry-run=client -o yaml > tls-secret.yaml',
        context
      )
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const fileResult = context.fileSystem.readFile('tls-secret.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Secret')
      expect(fileResult.value).toContain('name: tls-secret')
      expect(fileResult.value).toContain('type: kubernetes.io/tls')
    })

    it('should redirect create secret docker-registry dry-run yaml output to a file', () => {
      const result = handler.execute(
        'kubectl create secret docker-registry regcred --docker-server=docker.io --docker-username=alice --docker-password=s3cr3t --dry-run=client -o yaml > regcred.yaml',
        context
      )
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const fileResult = context.fileSystem.readFile('regcred.yaml')
      expect(fileResult.ok).toBe(true)
      if (!fileResult.ok) {
        return
      }
      expect(fileResult.value).toContain('kind: Secret')
      expect(fileResult.value).toContain('name: regcred')
      expect(fileResult.value).toContain('type: kubernetes.io/dockerconfigjson')
    })

    it('should not write redirected file when kubectl command fails', () => {
      const result = handler.execute(
        'kubectl describe pod missing-pod > missing.yaml',
        context
      )
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain('not found')

      const fileResult = context.fileSystem.readFile('missing.yaml')
      expect(fileResult.ok).toBe(false)
    })

    it('should return error for missing output file after redirection', () => {
      const result = handler.execute('kubectl get pods >', context)
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain(
        'missing output file after redirection operator'
      )
    })
  })
})
