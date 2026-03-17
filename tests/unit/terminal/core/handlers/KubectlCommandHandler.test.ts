import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPodCreatedEvent,
  createPodUpdatedEvent
} from '../../../../../src/core/cluster/events/types'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import type { CommandContext } from '../../../../../src/core/terminal/core/CommandContext'
import { createFileSystem } from '../../../../../src/core/filesystem/FileSystem'
import { KubectlCommandHandler } from '../../../../../src/core/terminal/core/handlers/KubectlCommandHandler'
import { ShellContextStack } from '../../../../../src/core/terminal/core/ShellContext'
import { createTerminalOutput } from '../../../../../src/core/terminal/core/TerminalOutput'
import { createMockRenderer } from '../../../helpers/mockRenderer'
import { createLogger } from '../../../../../src/logger/Logger'
import type { EditorModal } from '../../../../../src/core/shell/commands'

describe('KubectlCommandHandler', () => {
  let handler: KubectlCommandHandler
  let context: CommandContext
  let renderer: ReturnType<typeof createMockRenderer>
  let streamStop: (() => void) | null

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
    const apiServer = createApiServerFacade({ eventBus })
    const logger = createLogger()

    context = {
      fileSystem,
      renderer,
      output: createTerminalOutput(renderer),
      shellContextStack,
      logger,
      apiServer,
      startStream: (stop) => {
        streamStop = stop
      }
    }

    handler = new KubectlCommandHandler()
    streamStop = null
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
    const getCellStartIndex = (line: string, value: string): number => {
      return line.indexOf(value)
    }

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

    it('should open editor for kubectl edit and persist saved changes', () => {
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'edit-demo',
          namespace: 'default',
          containers: [{ name: 'web', image: 'nginx:1.25' }]
        })
      )

      let capturedContent = ''
      let capturedSave: ((newContent: string) => void) | undefined
      const editorModal: EditorModal = {
        open: (_filename, content, onSave) => {
          capturedContent = content
          capturedSave = onSave
        }
      }
      context.editorModal = editorModal

      const result = handler.execute('kubectl edit pod edit-demo', context)
      expect(result.ok).toBe(true)
      expect(capturedSave).toBeDefined()
      if (capturedSave == null) {
        return
      }

      capturedSave(capturedContent.replace('nginx:1.25', 'nginx:1.26'))
      const podResult = context.apiServer.findResource('Pod', 'edit-demo', 'default')
      expect(podResult.ok).toBe(true)
      if (!podResult.ok) {
        return
      }
      expect(podResult.value.spec.containers[0].image).toBe('nginx:1.26')
      expect(renderer.getOutput()).toContain('pod/edit-demo edited')
    })

    it('should preserve failed kubectl edit content in temporary file', () => {
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'edit-demo',
          namespace: 'default',
          containers: [{ name: 'edit-demo', image: 'nginx:1.25' }]
        })
      )

      let capturedContent = ''
      let capturedSave: ((newContent: string) => void) | undefined
      const editorModal: EditorModal = {
        open: (_filename, content, onSave) => {
          capturedContent = content
          capturedSave = onSave
        }
      }
      context.editorModal = editorModal

      const result = handler.execute('kubectl edit pod edit-demo', context)
      expect(result.ok).toBe(true)
      expect(capturedSave).toBeDefined()
      if (capturedSave == null) {
        return
      }

      capturedSave(
        capturedContent.replace(
          'name: edit-demo',
          'name: edit-demoo'
        )
      )

      const output = renderer.getOutput()
      expect(output).toContain('A copy of your changes has been stored to')
      const copiedPathMatch = output.match(/"([^"]*kubectl-edit-[^"]*\.yaml)"/)
      expect(copiedPathMatch).not.toBeNull()
      if (copiedPathMatch == null) {
        return
      }
      const copiedFileResult = context.fileSystem.readFile(copiedPathMatch[1])
      expect(copiedFileResult.ok).toBe(true)
      if (!copiedFileResult.ok) {
        return
      }
      expect(copiedFileResult.value).toContain('name: edit-demoo')
      expect(output).toContain(
        'error: pods "edit-demo" is invalid'
      )
      expect(output).toContain('error: Edit cancelled, no valid changes were saved.')
    })

    it('should enter container context for exec shell directive', () => {
      const pod = createPod({
        name: 'exec-pod',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      context.apiServer.etcd.restore({
        ...context.apiServer.snapshotState(),
        pods: {
          ...context.apiServer.snapshotState().pods,
          items: [pod]
        }
      })

      const result = handler.execute('kubectl exec exec-pod -- sh', context)
      expect(result.ok).toBe(true)
      expect(context.shellContextStack.isInContainer()).toBe(true)
      expect(context.shellContextStack.getCurrentContainerInfo()).toEqual({
        podName: 'exec-pod',
        containerName: 'main',
        namespace: 'default'
      })
    })

    it('should execute one-off shell command in target container', () => {
      const pod = createPod({
        name: 'exec-pod',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      context.apiServer.etcd.restore({
        ...context.apiServer.snapshotState(),
        pods: {
          ...context.apiServer.snapshotState().pods,
          items: [pod]
        }
      })
      renderer.clearOutput()

      const result = handler.execute('kubectl exec exec-pod -- ls /', context)
      expect(result.ok).toBe(true)
      const output = renderer.getOutput()
      expect(output).not.toContain('SHELL_COMMAND:')
      expect(output.length).toBeGreaterThan(0)
    })

    it('should update pod status when nginx -s stop is executed', () => {
      const pod = createPod({
        name: 'always-pod',
        namespace: 'default',
        phase: 'Running',
        restartPolicy: 'Always',
        containers: [{ name: 'always-pod', image: 'nginx:1.28' }]
      })
      context.apiServer.etcd.restore({
        ...context.apiServer.snapshotState(),
        pods: {
          ...context.apiServer.snapshotState().pods,
          items: [pod]
        }
      })

      const result = handler.execute(
        'kubectl exec always-pod -- nginx -s stop',
        context
      )
      expect(result.ok).toBe(true)

      const updatedPodResult = context.apiServer.findResource(
        'Pod',
        'always-pod',
        'default'
      )
      expect(updatedPodResult.ok).toBe(true)
      if (!updatedPodResult.ok) {
        return
      }
      expect(updatedPodResult.value.status.phase).toBe('Pending')
      expect(updatedPodResult.value.status.restartCount).toBe(1)
      const targetStatus = updatedPodResult.value.status.containerStatuses?.find(
        (status) => status.name === 'always-pod'
      )
      expect(targetStatus?.restartCount).toBe(1)
      expect(targetStatus?.stateDetails?.state).toBe('Waiting')
      expect(targetStatus?.stateDetails?.reason).toBe('ContainerCreating')
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

      const deployment = context.apiServer.findResource(
        'Deployment',
        'myapp',
        'default'
      )
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

      const service = context.apiServer.findResource('Service', 'my-svc', 'default')
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

    it('should render initial snapshot and updates in watch mode', () => {
      const createResult = handler.execute(
        'kubectl run watch-one --image=nginx',
        context
      )
      expect(createResult.ok).toBe(true)
      renderer.clearOutput()

      const watchResult = handler.execute('kubectl get pods --watch', context)
      expect(watchResult.ok).toBe(true)
      const initialOutput = renderer.getOutput()
      expect(initialOutput).toContain('NAME')
      expect(initialOutput).toContain('watch-one')
      expect(streamStop).not.toBeNull()
      renderer.clearOutput()

      const otherPod = createPod({
        name: 'watch-two',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'watch-two', image: 'nginx:latest' }]
      })
      context.apiServer.eventBus.emit(createPodCreatedEvent(otherPod, 'test'))
      const watchUpdateOutput = renderer.getOutput()
      expect(watchUpdateOutput).toContain('watch-two')
      expect(watchUpdateOutput).not.toContain('NAME')

      streamStop?.()
      renderer.clearOutput()
      const thirdPod = createPod({
        name: 'watch-three',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'watch-three', image: 'nginx:latest' }]
      })
      context.apiServer.eventBus.emit(createPodCreatedEvent(thirdPod, 'test'))
      expect(renderer.getOutput()).toBe('')
    })

    it('should not print initial output in watch-only mode', () => {
      const createResult = handler.execute(
        'kubectl run watch-only-pod --image=nginx',
        context
      )
      expect(createResult.ok).toBe(true)
      renderer.clearOutput()

      const watchOnlyResult = handler.execute(
        'kubectl get pods --watch-only',
        context
      )
      expect(watchOnlyResult.ok).toBe(true)
      expect(renderer.getOutput()).toBe('')

      const updatedPod = createPod({
        name: 'watch-only-next',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'watch-only-next', image: 'nginx:latest' }]
      })
      context.apiServer.eventBus.emit(createPodCreatedEvent(updatedPod, 'test'))
      expect(renderer.getOutput()).toContain('watch-only-next')
    })

    it('should keep watch columns stable after status width growth', () => {
      const watchResult = handler.execute('kubectl get pods --watch', context)
      expect(watchResult.ok).toBe(true)
      renderer.clearOutput()

      const basePod = createPod({
        name: 'status-demo',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'status-demo', image: 'nginx:latest' }],
        containerStatusOverrides: [
          {
            name: 'status-demo',
            restartCount: 11,
            stateDetails: { state: 'Waiting', reason: 'Pending' }
          }
        ]
      })
      context.apiServer.eventBus.emit(createPodCreatedEvent(basePod, 'test'))
      renderer.clearOutput()

      const longStatusPod = createPod({
        name: 'status-demo',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'status-demo', image: 'nginx:latest' }],
        containerStatusOverrides: [
          {
            name: 'status-demo',
            restartCount: 22,
            stateDetails: { state: 'Waiting', reason: 'ImagePullBackOff' }
          }
        ]
      })
      context.apiServer.eventBus.emit(
        createPodUpdatedEvent('status-demo', 'default', longStatusPod, basePod, 'test')
      )
      const longLine = renderer
        .getOutput()
        .split('\n')
        .find((line) => line.includes('status-demo'))
      expect(longLine).toBeTruthy()
      if (longLine == null) {
        return
      }
      const longRestartsIndex = getCellStartIndex(longLine, '22')
      expect(longRestartsIndex).toBeGreaterThan(0)
      renderer.clearOutput()

      const shortAfterLongPod = createPod({
        name: 'status-demo',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'status-demo', image: 'nginx:latest' }],
        containerStatusOverrides: [
          {
            name: 'status-demo',
            restartCount: 33,
            stateDetails: { state: 'Waiting', reason: 'ErrImagePull' }
          }
        ]
      })
      context.apiServer.eventBus.emit(
        createPodUpdatedEvent(
          'status-demo',
          'default',
          shortAfterLongPod,
          longStatusPod,
          'test'
        )
      )
      const shortAfterLongLine = renderer
        .getOutput()
        .split('\n')
        .find((line) => line.includes('status-demo'))
      expect(shortAfterLongLine).toBeTruthy()
      if (shortAfterLongLine == null) {
        return
      }
      const shortAfterLongRestartsIndex = getCellStartIndex(shortAfterLongLine, '33')
      expect(shortAfterLongRestartsIndex).toBe(longRestartsIndex)
    })

    it('should ignore unrelated pods when watching a named pod', () => {
      const createResult = handler.execute(
        'kubectl run only-this --image=nginx',
        context
      )
      expect(createResult.ok).toBe(true)
      renderer.clearOutput()

      const watchResult = handler.execute(
        'kubectl get pod only-this --watch',
        context
      )
      expect(watchResult.ok).toBe(true)
      renderer.clearOutput()

      const unrelated = createPod({
        name: 'other-pod',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'other-pod', image: 'nginx:latest' }]
      })
      context.apiServer.eventBus.emit(createPodCreatedEvent(unrelated, 'test'))
      expect(renderer.getOutput()).toBe('')
    })

    it('should stream new lines for kubectl logs -f', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-03-17T15:00:00Z'))
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'log-demo',
          namespace: 'default',
          containers: [{ name: 'app', image: 'generic:latest' }]
        })
      )

      const result = handler.execute('kubectl logs -f log-demo', context)
      expect(result.ok).toBe(true)
      expect(streamStop).not.toBeNull()
      renderer.clearOutput()

      vi.advanceTimersByTime(30000)
      const streamedOutput = renderer.getOutput()
      expect(streamedOutput.length).toBeGreaterThan(0)

      streamStop?.()
      renderer.clearOutput()
      vi.advanceTimersByTime(30000)
      expect(renderer.getOutput()).toBe('')
      vi.useRealTimers()
    })

    it('should reject output redirection in logs follow mode', () => {
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'log-demo',
          namespace: 'default',
          containers: [{ name: 'app', image: 'generic:latest' }]
        })
      )
      const result = handler.execute('kubectl logs -f log-demo > out.txt', context)
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain(
        'unsupported output redirection syntax for follow mode'
      )
    })
  })
})
