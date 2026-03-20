import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createPodDeletedEvent } from '../../../../src/core/cluster/events/types'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createPodTerminationController } from '../../../../src/core/kubelet/controllers/PodTerminationController'
import { createContainerProcessRuntime } from '../../../../src/core/runtime/ContainerProcessRuntime'

describe('PodTerminationController', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('finalizes pod deletion after minimum terminating visibility window', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'grace-pod',
        namespace: 'default',
        nodeName: 'conformance-worker',
        phase: 'Running',
        containers: [{ name: 'main', image: 'busybox' }]
      })
    )
    const requestResult = apiServer.requestPodDeletion('grace-pod', 'default', {
      gracePeriodSeconds: 1,
      source: 'test'
    })
    expect(requestResult.ok).toBe(true)
    const controller = createPodTerminationController(apiServer)

    expect(apiServer.findResource('Pod', 'grace-pod', 'default').ok).toBe(true)
    vi.advanceTimersByTime(1600)
    expect(apiServer.findResource('Pod', 'grace-pod', 'default').ok).toBe(false)

    controller.stop()
  })

  it('keeps force-deleted pod visible as Terminating for a short delay', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'force-pod',
        namespace: 'default',
        nodeName: 'conformance-worker',
        phase: 'Running',
        containers: [{ name: 'main', image: 'busybox' }]
      })
    )
    const requestResult = apiServer.requestPodDeletion('force-pod', 'default', {
      gracePeriodSeconds: 0,
      force: true,
      source: 'test'
    })
    expect(requestResult.ok).toBe(true)
    const controller = createPodTerminationController(apiServer, {
      minVisibleTerminatingMs: 600
    })

    vi.advanceTimersByTime(300)
    const stillPresent = apiServer.findResource('Pod', 'force-pod', 'default')
    expect(stillPresent.ok).toBe(true)

    vi.advanceTimersByTime(400)
    const deleted = apiServer.findResource('Pod', 'force-pod', 'default')
    expect(deleted.ok).toBe(false)

    controller.stop()
  })

  it('does not schedule deletion for non terminating pod updates', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'regular-pod',
        namespace: 'default',
        nodeName: 'conformance-worker',
        phase: 'Running',
        containers: [{ name: 'main', image: 'busybox' }]
      })
    )
    const controller = createPodTerminationController(apiServer)

    vi.advanceTimersByTime(5000)
    const stillPresent = apiServer.findResource('Pod', 'regular-pod', 'default')
    expect(stillPresent.ok).toBe(true)

    controller.stop()
  })

  it('waits until grace period when long process is still running', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'sleeping-pod',
        namespace: 'default',
        nodeName: 'conformance-worker',
        phase: 'Running',
        containers: [
          { name: 'main', image: 'busybox', command: ['sleep', '3600'] }
        ]
      })
    )
    const processRuntime = {
      ensureMainProcess: vi.fn(),
      getMainProcess: vi.fn(),
      signalMainProcess: vi.fn(),
      clearPodProcesses: vi.fn(),
      listProcesses: vi.fn(() => {
        return [
          {
            processId: 'proc://stubbed',
            nodeName: 'conformance-worker',
            namespace: 'default',
            podName: 'sleeping-pod',
            containerName: 'main',
            argv: ['sleep', '3600'],
            state: 'Running' as const,
            launchMode: 'long-running' as const,
            startedAt: new Date().toISOString()
          }
        ]
      })
    }
    const requestResult = apiServer.requestPodDeletion(
      'sleeping-pod',
      'default',
      {
        gracePeriodSeconds: 2,
        source: 'test'
      }
    )
    expect(requestResult.ok).toBe(true)
    const controller = createPodTerminationController(apiServer, {
      minVisibleTerminatingMs: 200,
      processRuntime
    })

    vi.advanceTimersByTime(1200)
    expect(apiServer.findResource('Pod', 'sleeping-pod', 'default').ok).toBe(
      true
    )

    vi.advanceTimersByTime(1000)
    expect(apiServer.findResource('Pod', 'sleeping-pod', 'default').ok).toBe(
      false
    )

    controller.stop()
  })

  it('finalizes early when terminating pod has no running process', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'quick-delete-pod',
        namespace: 'default',
        nodeName: 'conformance-worker',
        phase: 'Running',
        containers: [{ name: 'main', image: 'busybox' }]
      })
    )
    const requestResult = apiServer.requestPodDeletion(
      'quick-delete-pod',
      'default',
      {
        gracePeriodSeconds: 30,
        source: 'test'
      }
    )
    expect(requestResult.ok).toBe(true)
    const controller = createPodTerminationController(apiServer, {
      minVisibleTerminatingMs: 600
    })

    vi.advanceTimersByTime(300)
    expect(
      apiServer.findResource('Pod', 'quick-delete-pod', 'default').ok
    ).toBe(true)

    vi.advanceTimersByTime(400)
    expect(
      apiServer.findResource('Pod', 'quick-delete-pod', 'default').ok
    ).toBe(false)

    controller.stop()
  })

  it('finalizes finite sleep process before grace deadline', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const processRuntime = createContainerProcessRuntime()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'short-sleep-pod',
        namespace: 'default',
        nodeName: 'conformance-worker',
        phase: 'Running',
        containers: [
          { name: 'main', image: 'busybox', command: ['sleep', '2'] }
        ]
      })
    )
    processRuntime.ensureMainProcess({
      nodeName: 'conformance-worker',
      namespace: 'default',
      podName: 'short-sleep-pod',
      containerName: 'main',
      command: ['sleep', '2']
    })
    const requestResult = apiServer.requestPodDeletion(
      'short-sleep-pod',
      'default',
      {
        gracePeriodSeconds: 30,
        source: 'test'
      }
    )
    expect(requestResult.ok).toBe(true)
    const controller = createPodTerminationController(apiServer, {
      minVisibleTerminatingMs: 500,
      processCheckIntervalMs: 200,
      processRuntime
    })

    vi.advanceTimersByTime(5000)
    expect(apiServer.findResource('Pod', 'short-sleep-pod', 'default').ok).toBe(
      false
    )

    controller.stop()
  })

  it('cleans timeout state when pod deleted event arrives', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const pod = createPod({
      name: 'deleted-event-pod',
      namespace: 'default',
      nodeName: 'conformance-worker',
      phase: 'Running',
      containers: [{ name: 'main', image: 'busybox' }]
    })
    apiServer.createResource('Pod', pod)
    apiServer.requestPodDeletion('deleted-event-pod', 'default', {
      gracePeriodSeconds: 5,
      source: 'test'
    })
    const controller = createPodTerminationController(apiServer)

    apiServer.emitEvent(
      createPodDeletedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        pod,
        'test'
      )
    )
    vi.advanceTimersByTime(6000)
    const deleted = apiServer.findResource(
      'Pod',
      'deleted-event-pod',
      'default'
    )
    expect(deleted.ok).toBe(false)

    controller.stop()
  })
})
