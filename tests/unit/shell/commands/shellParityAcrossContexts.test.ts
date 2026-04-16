import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import { executeInitContainer } from '../../../../src/core/cluster/initContainers/executor'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import type { CommandContext } from '../../../../src/core/terminal/core/CommandContext'
import { ShellContextStack } from '../../../../src/core/terminal/core/ShellContext'
import { createTerminalOutput } from '../../../../src/core/terminal/core/TerminalOutput'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import { initializeSimNetworkRuntime } from '../../../../src/core/network/SimNetworkRuntime'
import { ShellCommandHandler } from '../../../../src/core/terminal/core/handlers/ShellCommandHandler'
import { KubectlCommandHandler } from '../../../../src/core/terminal/core/handlers/KubectlCommandHandler'
import { createLogger } from '../../../../src/logger/Logger'
import { createMockRenderer } from '../../helpers/mockRenderer'

const buildHomeRoot = () => {
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
  return {
    type: 'directory' as const,
    name: 'root',
    path: '/',
    children: new Map([['home', homeDir]]),
    createdAt: '',
    modifiedAt: ''
  }
}

describe('shell parity across host, exec and init containers', () => {
  let context: CommandContext

  beforeEach(() => {
    const fileSystemState = {
      currentPath: '/home/kube',
      tree: buildHomeRoot()
    }
    const shellContextStack = new ShellContextStack(fileSystemState)
    const fileSystem = createFileSystem(fileSystemState, undefined, {
      mutable: true
    })
    const renderer = createMockRenderer()
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
  })

  afterEach(() => {
    context.networkRuntime.controller.stop()
  })

  it('executes equivalent chained command with identical filesystem effect', () => {
    const script = 'mkdir -p /data && echo parity > /data/value.txt'

    const hostHandler = new ShellCommandHandler()
    const hostResult = hostHandler.execute(script, context)
    expect(hostResult.ok).toBe(true)
    const hostRead = context.fileSystem.readFile('/data/value.txt')
    expect(hostRead.ok).toBe(true)
    if (!hostRead.ok) {
      return
    }

    const pod = createPod({
      name: 'parity-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'main', image: 'busybox:1.36' }]
    })
    const createResult = context.apiServer.createResource('Pod', pod)
    expect(createResult.ok).toBe(true)

    const kubectlHandler = new KubectlCommandHandler()
    const execResult = kubectlHandler.execute(
      `kubectl exec parity-pod -- sh -c "${script}"`,
      context
    )
    expect(execResult.ok).toBe(true)

    const updatedPodResult = context.apiServer.findResource(
      'Pod',
      'parity-pod',
      'default'
    )
    expect(updatedPodResult.ok).toBe(true)
    if (!updatedPodResult.ok) {
      return
    }
    const execFileSystem = createFileSystem(
      updatedPodResult.value._simulator.containers.main.fileSystem
    )
    const execRead = execFileSystem.readFile('/data/value.txt')
    expect(execRead.ok).toBe(true)
    if (!execRead.ok) {
      return
    }

    const initBaseFs = createFileSystem().toJSON()
    const initResult = executeInitContainer(
      {
        name: 'init',
        image: 'busybox:1.36',
        command: ['sh'],
        args: ['-c', script]
      },
      initBaseFs
    )
    expect(initResult.ok).toBe(true)
    if (!initResult.ok) {
      return
    }
    const initFileSystem = createFileSystem(initResult.value)
    const initRead = initFileSystem.readFile('/data/value.txt')
    expect(initRead.ok).toBe(true)
    if (!initRead.ok) {
      return
    }

    expect(hostRead.value).toBe('parity')
    expect(execRead.value).toBe('parity')
    expect(initRead.value).toBe('parity')
  })

  it('returns equivalent error for unsupported shell syntax (||)', () => {
    const script = 'touch /data/a || touch /data/b'
    const hostHandler = new ShellCommandHandler()
    const hostResult = hostHandler.execute(script, context)
    expect(hostResult.ok).toBe(false)
    if (hostResult.ok) {
      return
    }

    const pod = createPod({
      name: 'parity-syntax-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'main', image: 'busybox:1.36' }]
    })
    const createResult = context.apiServer.createResource('Pod', pod)
    expect(createResult.ok).toBe(true)

    const kubectlHandler = new KubectlCommandHandler()
    const execResult = kubectlHandler.execute(
      `kubectl exec parity-syntax-pod -- sh -c "${script}"`,
      context
    )
    expect(execResult.ok).toBe(false)
    if (execResult.ok) {
      return
    }

    const initBaseFs = createFileSystem().toJSON()
    const initResult = executeInitContainer(
      {
        name: 'init',
        image: 'busybox:1.36',
        command: ['sh'],
        args: ['-c', script]
      },
      initBaseFs
    )
    expect(initResult.ok).toBe(false)
    if (initResult.ok) {
      return
    }

    expect(hostResult.error).toContain('unsupported shell syntax')
    expect(execResult.error).toContain('unsupported shell syntax')
    expect(initResult.error).toContain('unsupported shell syntax')
  })

  it('returns equivalent error for unknown command', () => {
    const script = 'unknowncmd'
    const hostHandler = new ShellCommandHandler()
    const hostResult = hostHandler.execute(script, context)
    expect(hostResult.ok).toBe(false)
    if (hostResult.ok) {
      return
    }

    const pod = createPod({
      name: 'parity-error-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'main', image: 'busybox:1.36' }]
    })
    const createResult = context.apiServer.createResource('Pod', pod)
    expect(createResult.ok).toBe(true)

    const kubectlHandler = new KubectlCommandHandler()
    const execResult = kubectlHandler.execute(
      `kubectl exec parity-error-pod -- sh -c "${script}"`,
      context
    )
    expect(execResult.ok).toBe(false)
    if (execResult.ok) {
      return
    }

    const initBaseFs = createFileSystem().toJSON()
    const initResult = executeInitContainer(
      {
        name: 'init',
        image: 'busybox:1.36',
        command: ['sh'],
        args: ['-c', script]
      },
      initBaseFs
    )
    expect(initResult.ok).toBe(false)
    if (initResult.ok) {
      return
    }

    expect(hostResult.error).toContain('command not found')
    expect(execResult.error).toContain('command not found')
    expect(initResult.error).toContain('command not found')
  })

  it('returns equivalent error for invalid echo redirection target', () => {
    const script = 'echo hi >'
    const hostHandler = new ShellCommandHandler()
    const hostResult = hostHandler.execute(script, context)
    expect(hostResult.ok).toBe(false)
    if (hostResult.ok) {
      return
    }

    const pod = createPod({
      name: 'parity-redirect-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'main', image: 'busybox:1.36' }]
    })
    const createResult = context.apiServer.createResource('Pod', pod)
    expect(createResult.ok).toBe(true)

    const kubectlHandler = new KubectlCommandHandler()
    const execResult = kubectlHandler.execute(
      `kubectl exec parity-redirect-pod -- sh -c "${script}"`,
      context
    )
    expect(execResult.ok).toBe(false)
    if (execResult.ok) {
      return
    }

    const initBaseFs = createFileSystem().toJSON()
    const initResult = executeInitContainer(
      {
        name: 'init',
        image: 'busybox:1.36',
        command: ['sh'],
        args: ['-c', script]
      },
      initBaseFs
    )
    expect(initResult.ok).toBe(false)
    if (initResult.ok) {
      return
    }

    expect(hostResult.error).toContain('missing file operand after redirection')
    expect(execResult.error).toContain('missing file operand after redirection')
    expect(initResult.error).toContain('missing file operand after redirection')
  })

  it('executes equivalent pipeline script with identical filesystem effect', () => {
    const script = 'mkdir -p /data && echo parity-pipe > /data/value.txt && cat /data/value.txt | cat'
    const hostHandler = new ShellCommandHandler()
    const hostResult = hostHandler.execute(script, context)
    expect(hostResult.ok).toBe(true)
    if (!hostResult.ok) {
      return
    }
    const hostRead = context.fileSystem.readFile('/data/value.txt')
    expect(hostRead.ok).toBe(true)
    if (!hostRead.ok) {
      return
    }
    expect(hostRead.value).toBe('parity-pipe')
    expect(hostResult.value).toContain('parity-pipe')

    const pod = createPod({
      name: 'parity-pipe-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'main', image: 'busybox:1.36' }]
    })
    const createResult = context.apiServer.createResource('Pod', pod)
    expect(createResult.ok).toBe(true)

    const kubectlHandler = new KubectlCommandHandler()
    const execResult = kubectlHandler.execute(
      `kubectl exec parity-pipe-pod -- sh -c "${script}"`,
      context
    )
    expect(execResult.ok).toBe(true)
    if (!execResult.ok) {
      return
    }
    expect(execResult.value).toContain('parity-pipe')
    const updatedPodResult = context.apiServer.findResource(
      'Pod',
      'parity-pipe-pod',
      'default'
    )
    expect(updatedPodResult.ok).toBe(true)
    if (!updatedPodResult.ok) {
      return
    }
    const execFileSystem = createFileSystem(
      updatedPodResult.value._simulator.containers.main.fileSystem
    )
    const execRead = execFileSystem.readFile('/data/value.txt')
    expect(execRead.ok).toBe(true)
    if (!execRead.ok) {
      return
    }
    expect(execRead.value).toBe('parity-pipe')

    const initBaseFs = createFileSystem().toJSON()
    const initResult = executeInitContainer(
      {
        name: 'init',
        image: 'busybox:1.36',
        command: ['sh'],
        args: ['-c', script]
      },
      initBaseFs
    )
    expect(initResult.ok).toBe(true)
    if (!initResult.ok) {
      return
    }
    const initFileSystem = createFileSystem(initResult.value)
    const initRead = initFileSystem.readFile('/data/value.txt')
    expect(initRead.ok).toBe(true)
    if (!initRead.ok) {
      return
    }
    expect(initRead.value).toBe('parity-pipe')
  })

  it('returns equivalent error for invalid pipeline syntax', () => {
    const script = 'echo broken |'
    const hostHandler = new ShellCommandHandler()
    const hostResult = hostHandler.execute(script, context)
    expect(hostResult.ok).toBe(false)
    if (hostResult.ok) {
      return
    }

    const pod = createPod({
      name: 'parity-invalid-pipe-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'main', image: 'busybox:1.36' }]
    })
    const createResult = context.apiServer.createResource('Pod', pod)
    expect(createResult.ok).toBe(true)

    const kubectlHandler = new KubectlCommandHandler()
    const execResult = kubectlHandler.execute(
      `kubectl exec parity-invalid-pipe-pod -- sh -c "${script}"`,
      context
    )
    expect(execResult.ok).toBe(false)
    if (execResult.ok) {
      return
    }

    const initBaseFs = createFileSystem().toJSON()
    const initResult = executeInitContainer(
      {
        name: 'init',
        image: 'busybox:1.36',
        command: ['sh'],
        args: ['-c', script]
      },
      initBaseFs
    )
    expect(initResult.ok).toBe(false)
    if (initResult.ok) {
      return
    }

    expect(hostResult.error).toContain('invalid pipeline')
    expect(execResult.error).toContain('invalid pipeline')
    expect(initResult.error).toContain('invalid pipeline')
  })
})
