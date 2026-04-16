import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { initializeSimNetworkRuntime } from '../../../../../src/core/network/SimNetworkRuntime'
import type { EditorModal } from '../../../../../src/core/shell/commands'
import { ShellCommandHandler } from '../../../../../src/core/terminal/core/handlers/ShellCommandHandler'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createPersistentVolume } from '../../../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../../../src/core/cluster/ressources/PersistentVolumeClaim'
import {
  createSecret,
  encodeBase64
} from '../../../../../src/core/cluster/ressources/Secret'

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
    const networkRuntime = initializeSimNetworkRuntime(apiServer)
    const logger = createLogger()

    context = {
      fileSystem,
      renderer,
      output: createTerminalOutput(renderer),
      shellContextStack,
      logger,
      apiServer,
      networkRuntime,
      startStream: (stop) => {
        streamStop = stop
      }
    }

    handler = new KubectlCommandHandler()
    streamStop = null
  })

  afterEach(() => {
    context.networkRuntime.controller.stop()
  })

  describe('canHandle', () => {
    it('should return true for kubectl commands', () => {
      expect(handler.canHandle('kubectl get pods')).toBe(true)
      expect(handler.canHandle('kubectl describe pod my-pod')).toBe(true)
      expect(handler.canHandle('kubectl apply -f file.yaml')).toBe(true)
      expect(handler.canHandle('kubectl logs my-pod')).toBe(true)
      expect(handler.canHandle('kubectl exec -it my-pod -- /bin/sh')).toBe(true)
    })

    it('should return true for k alias commands', () => {
      expect(handler.canHandle('k')).toBe(true)
      expect(handler.canHandle('k get pods')).toBe(true)
      expect(handler.canHandle('k\tget pods')).toBe(true)
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
      expect(handler.canHandle('kind')).toBe(false)
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

    it('should execute k alias like kubectl get pods', () => {
      const result = handler.execute('k get pods', context)
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

    it('should short-circuit help before parser validation', () => {
      const result = handler.execute('kubectl get --help', context)
      expect(result.ok).toBe(true)
      const output = renderer.getOutput()
      expect(output).toContain('Display one or many resources.')
      expect(output).not.toContain('Invalid or missing resource type')
    })

    it('should render kubectl-like unknown shorthand error for get', () => {
      const result = handler.execute('kubectl get -toto', context)
      expect(result.ok).toBe(false)
      const output = renderer.getOutput()
      expect(output).toContain("error: unknown shorthand flag: 't' in -toto")
      expect(output).toContain("See 'kubectl get --help' for usage.")
    })

    it('should render kubectl-like unknown shorthand error for describe', () => {
      const result = handler.execute('kubectl describe -toto', context)
      expect(result.ok).toBe(false)
      const output = renderer.getOutput()
      expect(output).toContain("error: unknown shorthand flag: 't' in -toto")
      expect(output).toContain("See 'kubectl describe --help' for usage.")
    })

    it('should render kubectl-like unknown shorthand error for describe pod -ok', () => {
      const result = handler.execute('kubectl describe pod -ok', context)
      expect(result.ok).toBe(false)
      const output = renderer.getOutput()
      expect(output).toContain("error: unknown shorthand flag: 'o' in -ok")
      expect(output).toContain("See 'kubectl describe --help' for usage.")
    })

    it('should render kubectl-like unknown command error', () => {
      const result = handler.execute('kubectl coocococo', context)
      expect(result.ok).toBe(false)
      const output = renderer.getOutput()
      expect(output).toContain(
        'error: unknown command "coocococo" for "kubectl"'
      )
    })

    it('should support kubectl options command', () => {
      const result = handler.execute('kubectl options', context)
      expect(result.ok).toBe(true)
      const output = renderer.getOutput()
      expect(output).toContain(
        'The following options can be passed to any command:'
      )
      expect(output).toContain("-n, --namespace='':")
      expect(output).toContain("-s, --server='':")
      expect(output).toContain('--warnings-as-errors=false:')
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
      const podResult = context.apiServer.findResource(
        'Pod',
        'edit-demo',
        'default'
      )
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
        capturedContent.replace('name: edit-demo', 'name: edit-demoo')
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
      expect(output).toContain('error: pods "edit-demo" is invalid')
      expect(output).toContain(
        'error: Edit cancelled, no valid changes were saved.'
      )
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

    it('should enter container context for interactive kubectl run shell', () => {
      const result = handler.execute(
        'kubectl run dns-test --image=busybox:1.36 --restart=Never -it --rm -- /bin/sh',
        context
      )
      expect(result.ok).toBe(true)
      expect(context.shellContextStack.isInContainer()).toBe(true)
      expect(context.shellContextStack.getCurrentContainerInfo()).toEqual({
        podName: 'dns-test',
        containerName: 'dns-test',
        namespace: 'default'
      })
      const podResult = context.apiServer.findResource(
        'Pod',
        'dns-test',
        'default'
      )
      expect(podResult.ok).toBe(true)
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

    it('should print defaulted container notice for init container pods', () => {
      const pod = createPod({
        name: 'init-exec-pod',
        namespace: 'default',
        phase: 'Running',
        initContainers: [{ name: 'write-data', image: 'busybox:1.36' }],
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })
      context.apiServer.etcd.restore({
        ...context.apiServer.snapshotState(),
        pods: {
          ...context.apiServer.snapshotState().pods,
          items: [pod]
        }
      })
      renderer.clearOutput()

      const result = handler.execute(
        'kubectl exec init-exec-pod -- cat /etc/hostname',
        context
      )
      expect(result.ok).toBe(true)
      const output = renderer.getOutput()
      expect(output).toContain(
        'Defaulted container "app" out of: app, write-data (init)'
      )
    })

    it('should expose pod name in /etc/hostname inside container', () => {
      const pod = createPod({
        name: 'realistic-hostname',
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

      const result = handler.execute(
        'kubectl exec realistic-hostname -- cat /etc/hostname',
        context
      )

      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('realistic-hostname')
    })

    it('should expose kubernetes resolv.conf inside container', () => {
      const pod = createPod({
        name: 'dns-pod',
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

      const result = handler.execute(
        'kubectl exec dns-pod -- cat /etc/resolv.conf',
        context
      )

      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain(
        'search default.svc.cluster.local svc.cluster.local cluster.local'
      )
      expect(renderer.getOutput()).toContain('nameserver 10.96.0.10')
      expect(renderer.getOutput()).toContain('options ndots:5')
    })

    it('should render stdout and stderr for failing kubectl run attach command', () => {
      const deploymentResult = handler.execute(
        'kubectl create deployment backend --image=nginx',
        context
      )
      expect(deploymentResult.ok).toBe(true)
      const exposeResult = handler.execute(
        'kubectl expose deployment backend --port=80',
        context
      )
      expect(exposeResult.ok).toBe(true)
      renderer.clearOutput()

      const runResult = handler.execute(
        'kubectl run dns-test --image=busybox --rm -it --restart=Never -- nslookup backend',
        context
      )
      expect(runResult.ok).toBe(false)
      const output = renderer.getOutput()
      expect(output).toContain('Server:')
      expect(output).toContain('Name:\tbackend.default.svc.cluster.local')
      expect(output).toContain('pod "dns-test" deleted from default namespace')
      expect(output).toContain('pod default/dns-test terminated (Error)')
    })

    it('should keep container file changes isolated from host after exit', () => {
      const pod = createPod({
        name: 'log-demo',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'log-demo', image: 'busybox:latest' }]
      })
      context.apiServer.etcd.restore({
        ...context.apiServer.snapshotState(),
        pods: {
          ...context.apiServer.snapshotState().pods,
          items: [pod]
        }
      })

      const hostTouchResult = new ShellCommandHandler().execute(
        'touch test1',
        context
      )
      expect(hostTouchResult.ok).toBe(true)
      expect(context.fileSystem.readFile('test1').ok).toBe(true)

      const enterContainerResult = handler.execute(
        'kubectl exec -it log-demo -- /bin/sh',
        context
      )
      expect(enterContainerResult.ok).toBe(true)
      expect(context.shellContextStack.isInContainer()).toBe(true)

      const containerTouchResult = new ShellCommandHandler().execute(
        'touch test2',
        context
      )
      expect(containerTouchResult.ok).toBe(true)
      expect(context.fileSystem.readFile('test2').ok).toBe(false)

      const podResult = context.apiServer.findResource(
        'Pod',
        'log-demo',
        'default'
      )
      expect(podResult.ok).toBe(true)
      if (!podResult.ok) {
        return
      }
      const containerEntry = podResult.value._simulator.containers['log-demo']
      const containerFileSystem = createFileSystem(
        containerEntry.fileSystem,
        undefined,
        { mutable: true }
      )
      expect(containerFileSystem.readFile('test2').ok).toBe(true)

      const exitResult = new ShellCommandHandler().execute('exit', context)
      expect(exitResult.ok).toBe(true)
      expect(context.shellContextStack.isInContainer()).toBe(false)

      renderer.clearOutput()
      const hostLsResult = new ShellCommandHandler().execute('ls', context)
      expect(hostLsResult.ok).toBe(true)
      const hostOutput = renderer.getOutput()
      expect(hostOutput).toContain('test1')
      expect(hostOutput).not.toContain('test2')
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
      expect(updatedPodResult.value.status.phase).toBe('Running')
      expect(updatedPodResult.value.status.restartCount).toBe(1)
      const targetStatus =
        updatedPodResult.value.status.containerStatuses?.find(
          (status) => status.name === 'always-pod'
        )
      expect(targetStatus?.restartCount).toBe(1)
      expect(targetStatus?.stateDetails?.state).toBe('Waiting')
      expect(targetStatus?.stateDetails?.reason).toBe('ContainerCreating')
    })

    it('should restart container and reset local filesystem on kill 1', () => {
      const pod = createPod({
        name: 'ephemeral-demo',
        namespace: 'default',
        phase: 'Running',
        restartPolicy: 'Always',
        containers: [{ name: 'ephemeral-demo', image: 'nginx:1.28' }]
      })
      context.apiServer.etcd.restore({
        ...context.apiServer.snapshotState(),
        pods: {
          ...context.apiServer.snapshotState().pods,
          items: [pod]
        }
      })

      const writeResult = handler.execute(
        'kubectl exec ephemeral-demo -- touch /tmp/message.txt',
        context
      )
      expect(writeResult.ok).toBe(true)

      const beforeRestartResult = context.apiServer.findResource(
        'Pod',
        'ephemeral-demo',
        'default'
      )
      expect(beforeRestartResult.ok).toBe(true)
      if (!beforeRestartResult.ok) {
        return
      }
      const beforeContainerEntry =
        beforeRestartResult.value._simulator.containers['ephemeral-demo']
      const beforeFileSystem = createFileSystem(
        beforeContainerEntry.fileSystem,
        undefined,
        { mutable: true }
      )
      expect(beforeFileSystem.readFile('/tmp/message.txt').ok).toBe(true)

      const restartResult = handler.execute(
        'kubectl exec ephemeral-demo -- kill 1',
        context
      )
      expect(restartResult.ok).toBe(true)

      const updatedPodResult = context.apiServer.findResource(
        'Pod',
        'ephemeral-demo',
        'default'
      )
      expect(updatedPodResult.ok).toBe(true)
      if (!updatedPodResult.ok) {
        return
      }
      expect(updatedPodResult.value.status.phase).toBe('Running')
      expect(updatedPodResult.value.status.restartCount).toBe(1)
      const targetStatus =
        updatedPodResult.value.status.containerStatuses?.find(
          (status) => status.name === 'ephemeral-demo'
        )
      expect(targetStatus?.restartCount).toBe(1)
      expect(targetStatus?.stateDetails?.state).toBe('Waiting')
      expect(targetStatus?.stateDetails?.reason).toBe('ContainerCreating')

      const updatedContainerEntry =
        updatedPodResult.value._simulator.containers['ephemeral-demo']
      const updatedFileSystem = createFileSystem(
        updatedContainerEntry.fileSystem,
        undefined,
        { mutable: true }
      )
      expect(updatedFileSystem.readFile('/tmp/message.txt').ok).toBe(false)
    })

    it('should preserve emptyDir data across producer restart and share it between containers', () => {
      const pod = createPod({
        name: 'emptydir-demo',
        namespace: 'default',
        phase: 'Running',
        restartPolicy: 'Always',
        volumes: [
          {
            name: 'shared',
            source: { type: 'emptyDir' }
          }
        ],
        containers: [
          {
            name: 'producer',
            image: 'busybox:1.36',
            volumeMounts: [{ name: 'shared', mountPath: '/shared' }]
          },
          {
            name: 'consumer',
            image: 'busybox:1.36',
            volumeMounts: [{ name: 'shared', mountPath: '/shared' }]
          }
        ]
      })
      context.apiServer.etcd.restore({
        ...context.apiServer.snapshotState(),
        pods: {
          ...context.apiServer.snapshotState().pods,
          items: [pod]
        }
      })

      const writeSharedResult = handler.execute(
        'kubectl exec emptydir-demo -c producer -- touch /shared/message.txt',
        context
      )
      expect(writeSharedResult.ok).toBe(true)

      const writeLocalResult = handler.execute(
        'kubectl exec emptydir-demo -c producer -- touch /tmp/local.txt',
        context
      )
      expect(writeLocalResult.ok).toBe(true)

      const consumerReadBeforeRestartResult = handler.execute(
        'kubectl exec emptydir-demo -c consumer -- cat /shared/message.txt',
        context
      )
      expect(consumerReadBeforeRestartResult.ok).toBe(true)

      const restartResult = handler.execute(
        'kubectl exec emptydir-demo -c producer -- kill 1',
        context
      )
      expect(restartResult.ok).toBe(true)

      const updatedPodResult = context.apiServer.findResource(
        'Pod',
        'emptydir-demo',
        'default'
      )
      expect(updatedPodResult.ok).toBe(true)
      if (!updatedPodResult.ok) {
        return
      }

      const producerContainerEntry =
        updatedPodResult.value._simulator.containers['producer']
      const producerFileSystem = createFileSystem(
        producerContainerEntry.fileSystem,
        undefined,
        { mutable: true }
      )
      expect(producerFileSystem.readFile('/tmp/local.txt').ok).toBe(false)
      expect(producerFileSystem.readFile('/shared/message.txt').ok).toBe(true)

      const consumerContainerEntry =
        updatedPodResult.value._simulator.containers['consumer']
      const consumerFileSystem = createFileSystem(
        consumerContainerEntry.fileSystem,
        undefined,
        { mutable: true }
      )
      expect(consumerFileSystem.readFile('/shared/message.txt').ok).toBe(true)

      const consumerReadAfterRestartResult = handler.execute(
        'kubectl exec emptydir-demo -c consumer -- cat /shared/message.txt',
        context
      )
      expect(consumerReadAfterRestartResult.ok).toBe(true)
    })

    it('should mount ConfigMap keys as files in container volume path', () => {
      context.apiServer.createResource(
        'ConfigMap',
        createConfigMap({
          name: 'nginx-config',
          namespace: 'default',
          data: {
            'default.conf': 'server { listen 80; }'
          }
        })
      )
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'nginx-config-demo',
          namespace: 'default',
          phase: 'Running',
          volumes: [
            {
              name: 'nginx-conf',
              source: { type: 'configMap', name: 'nginx-config' }
            }
          ],
          containers: [
            {
              name: 'web',
              image: 'nginx:1.28',
              volumeMounts: [
                {
                  name: 'nginx-conf',
                  mountPath: '/etc/nginx/conf.d'
                }
              ]
            }
          ]
        })
      )

      const readResult = handler.execute(
        'kubectl exec nginx-config-demo -- cat /etc/nginx/conf.d/default.conf',
        context
      )
      expect(readResult.ok).toBe(true)
    })

    it('should mount Secret keys as decoded files in container volume path', () => {
      context.apiServer.createResource(
        'Secret',
        createSecret({
          name: 'app-creds',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: {
            username: encodeBase64('admin'),
            password: encodeBase64('s3cret')
          }
        })
      )
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'secret-volume-demo',
          namespace: 'default',
          phase: 'Running',
          volumes: [
            {
              name: 'creds',
              source: { type: 'secret', secretName: 'app-creds' }
            }
          ],
          containers: [
            {
              name: 'app',
              image: 'busybox:1.36',
              volumeMounts: [
                {
                  name: 'creds',
                  mountPath: '/credentials',
                  readOnly: true
                }
              ]
            }
          ]
        })
      )

      const readResult = handler.execute(
        'kubectl exec secret-volume-demo -- cat /credentials/username',
        context
      )
      expect(readResult.ok).toBe(true)
      expect(renderer.getOutput()).toContain('admin')
    })

    it('should persist PVC data after writer pod deletion and reader pod recreation', () => {
      context.apiServer.createResource(
        'PersistentVolume',
        createPersistentVolume({
          name: 'pv-lab',
          spec: {
            capacity: { storage: '1Gi' },
            accessModes: ['ReadWriteOnce'],
            hostPath: { path: '/mnt/data/pv-lab' }
          }
        })
      )
      context.apiServer.createResource(
        'PersistentVolumeClaim',
        createPersistentVolumeClaim({
          name: 'lab-claim',
          namespace: 'default',
          spec: {
            accessModes: ['ReadWriteOnce'],
            resources: { requests: { storage: '1Gi' } },
            volumeName: 'pv-lab'
          }
        })
      )
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'pvc-writer',
          namespace: 'default',
          phase: 'Running',
          volumes: [
            {
              name: 'data',
              source: { type: 'persistentVolumeClaim', claimName: 'lab-claim' }
            }
          ],
          containers: [
            {
              name: 'writer',
              image: 'busybox:1.36',
              volumeMounts: [{ name: 'data', mountPath: '/data' }]
            }
          ]
        })
      )
      renderer.clearOutput()

      const writeResult = handler.execute(
        'kubectl exec pvc-writer -- touch /data/record.txt',
        context
      )
      expect(writeResult.ok).toBe(true)

      context.apiServer.requestPodDeletion('pvc-writer', 'default', {
        source: 'unit-test'
      })
      context.apiServer.finalizePodDeletion('pvc-writer', 'default', {
        source: 'unit-test'
      })

      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'pvc-reader',
          namespace: 'default',
          phase: 'Running',
          volumes: [
            {
              name: 'data',
              source: { type: 'persistentVolumeClaim', claimName: 'lab-claim' }
            }
          ],
          containers: [
            {
              name: 'reader',
              image: 'busybox:1.36',
              volumeMounts: [{ name: 'data', mountPath: '/data' }]
            }
          ]
        })
      )
      const readerPodResult = context.apiServer.findResource(
        'Pod',
        'pvc-reader',
        'default'
      )
      expect(readerPodResult.ok).toBe(true)
      if (!readerPodResult.ok) {
        return
      }
      const readerContainerEntry =
        readerPodResult.value._simulator.containers['reader']
      const readerFileSystem = createFileSystem(
        readerContainerEntry.fileSystem,
        undefined,
        { mutable: true }
      )
      expect(readerFileSystem.readFile('/data/record.txt').ok).toBe(true)
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

      const service = context.apiServer.findResource(
        'Service',
        'my-svc',
        'default'
      )
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

    it('should return error for missing kubectl command before redirection', () => {
      const result = handler.execute('> pods.yaml', context)
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain(
        'missing kubectl command before output redirection'
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

    it('should enable watch stream with short -w flag', () => {
      const createResult = handler.execute(
        'kubectl run watch-short --image=nginx',
        context
      )
      expect(createResult.ok).toBe(true)
      renderer.clearOutput()

      const watchResult = handler.execute('kubectl get pods -w', context)
      expect(watchResult.ok).toBe(true)
      const initialOutput = renderer.getOutput()
      expect(initialOutput).toContain('NAME')
      expect(initialOutput).toContain('watch-short')
      expect(streamStop).not.toBeNull()
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
        createPodUpdatedEvent(
          'status-demo',
          'default',
          longStatusPod,
          basePod,
          'test'
        )
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
      const shortAfterLongRestartsIndex = getCellStartIndex(
        shortAfterLongLine,
        '33'
      )
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

    it('should apply set-based selector filtering in watch mode', () => {
      const watchResult = handler.execute(
        'kubectl get pods --watch -l "track notin (canary)"',
        context
      )
      expect(watchResult.ok).toBe(true)
      renderer.clearOutput()

      const canaryPod = createPod({
        name: 'watch-canary',
        namespace: 'default',
        labels: { app: 'web', track: 'canary' },
        phase: 'Pending',
        containers: [{ name: 'watch-canary', image: 'nginx:latest' }]
      })
      context.apiServer.eventBus.emit(createPodCreatedEvent(canaryPod, 'test'))
      expect(renderer.getOutput()).toBe('')

      const stablePod = createPod({
        name: 'watch-stable',
        namespace: 'default',
        labels: { app: 'web', track: 'stable' },
        phase: 'Pending',
        containers: [{ name: 'watch-stable', image: 'nginx:latest' }]
      })
      context.apiServer.eventBus.emit(createPodCreatedEvent(stablePod, 'test'))
      expect(renderer.getOutput()).toContain('watch-stable')
      expect(renderer.getOutput()).not.toContain('watch-canary')
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
      const result = handler.execute(
        'kubectl logs -f log-demo > out.txt',
        context
      )
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain(
        'unsupported output redirection syntax for follow mode'
      )
    })

    it('should reject kubectl logs with previous and follow together', () => {
      const result = handler.execute(
        'kubectl logs --previous -f log-demo',
        context
      )
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain(
        'error: only one of follow (-f) or previous (-p) is allowed'
      )
    })

    it('should keep rollout status attached to stream by default', () => {
      const applyResult = handler.execute(
        'kubectl create deployment stream-rollout --image=nginx --replicas=3',
        context
      )
      expect(applyResult.ok).toBe(true)
      renderer.clearOutput()

      const rolloutResult = handler.execute(
        'kubectl rollout status deployment/stream-rollout',
        context
      )
      expect(rolloutResult.ok).toBe(true)
      expect(streamStop).not.toBeNull()
      expect(renderer.getOutput()).toContain(
        'Waiting for deployment "stream-rollout" rollout to finish'
      )
    })

    it('should reject output redirection in rollout follow mode', () => {
      const result = handler.execute(
        'kubectl rollout status deployment/web-app > out.txt',
        context
      )
      expect(result.ok).toBe(false)
      expect(renderer.getOutput()).toContain(
        'unsupported output redirection syntax for rollout follow mode'
      )
    })

    it('should allow > character inside quoted jsonpath literal', () => {
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'web-a',
          namespace: 'default',
          labels: { app: 'web' },
          containers: [{ name: 'web', image: 'nginx:1.26' }]
        })
      )
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'web-b',
          namespace: 'default',
          labels: { app: 'web' },
          containers: [{ name: 'web', image: 'nginx:1.26' }]
        })
      )

      const result = handler.execute(
        `kubectl get pods -l app=web -o jsonpath='{range .items[*]}{.metadata.name}: {.spec.containers[0].image}{"<br/>"}{end}'`,
        context
      )

      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('<br/>')
      expect(renderer.getOutput()).not.toContain(
        'invalid jsonpath template, missing closing brace'
      )
    })

    it('should ignore inline shell comment after kubectl command', () => {
      context.apiServer.createResource(
        'Pod',
        createPod({
          name: 'web-c',
          namespace: 'default',
          labels: { app: 'web' },
          containers: [{ name: 'web', image: 'nginx:1.26' }]
        })
      )

      const result = handler.execute(
        `kubectl get pods -l app=web -o jsonpath='{range .items[*]}{.metadata.name}: {.spec.containers[0].image}{"\\n"}{end}'# All pods should show nginx:1.26`,
        context
      )

      expect(result.ok).toBe(true)
      expect(renderer.getOutput()).toContain('web-c: nginx:1.26')
      expect(renderer.getOutput()).not.toContain('Error from server (NotFound)')
    })
  })
})
