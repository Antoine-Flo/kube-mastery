import { describe, expect, it, vi } from 'vitest'
import { createContainerProcessRuntime } from '../../../src/core/runtime/ContainerProcessRuntime'

describe('ContainerProcessRuntime', () => {
  it('keeps sleep process running until duration elapses', () => {
    vi.useFakeTimers()
    const runtime = createContainerProcessRuntime()
    const process = runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-pod',
      containerName: 'main',
      command: ['sleep', '2']
    })

    expect(process.state).toBe('Running')
    vi.advanceTimersByTime(1000)
    const stillRunning = runtime.getMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-pod',
      containerName: 'main'
    })
    expect(stillRunning?.state).toBe('Running')

    vi.advanceTimersByTime(1500)
    const completed = runtime.getMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-pod',
      containerName: 'main'
    })
    expect(completed?.state).toBe('Exited')
    expect(completed?.exitCode).toBe(0)
    vi.useRealTimers()
  })

  it('applies kill signal with exit code 137', () => {
    const runtime = createContainerProcessRuntime()
    runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-pod',
      containerName: 'main',
      command: ['sleep', '3600']
    })
    const killed = runtime.signalMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-pod',
      containerName: 'main',
      signal: 'SIGKILL'
    })
    expect(killed?.state).toBe('Exited')
    expect(killed?.exitCode).toBe(137)
    expect(killed?.reason).toBe('Killed')
  })

  it('keeps long-running process alive after SIGTERM', () => {
    const runtime = createContainerProcessRuntime()
    runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-pod',
      containerName: 'main',
      command: ['sleep', '3600']
    })
    const terminated = runtime.signalMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-pod',
      containerName: 'main',
      signal: 'SIGTERM'
    })
    expect(terminated?.state).toBe('Running')
  })

  it('finishes short finite sleep soon after SIGTERM', () => {
    vi.useFakeTimers()
    const runtime = createContainerProcessRuntime()
    runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-short',
      containerName: 'main',
      command: ['sleep', '2']
    })
    runtime.signalMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-short',
      containerName: 'main',
      signal: 'SIGTERM'
    })
    vi.advanceTimersByTime(2500)
    const terminated = runtime.getMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'sleep-short',
      containerName: 'main'
    })
    expect(terminated?.state).toBe('Exited')
    expect(terminated?.exitCode).toBe(0)
    expect(terminated?.reason).toBe('Completed')
    vi.useRealTimers()
  })

  it('returns same record when ensure is called twice', () => {
    const runtime = createContainerProcessRuntime()
    const first = runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'idempotent-pod',
      containerName: 'main',
      command: ['sleep', '3600']
    })
    const second = runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'idempotent-pod',
      containerName: 'main',
      command: ['sleep', '3600']
    })
    expect(second.processId).toBe(first.processId)
    expect(second.startedAt).toBe(first.startedAt)
  })

  it('supports shell exit script immediate completion', () => {
    const runtime = createContainerProcessRuntime()
    const process = runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'shell-exit-pod',
      containerName: 'main',
      command: ['sh', '-c', 'exit 7']
    })
    expect(process.state).toBe('Exited')
    expect(process.exitCode).toBe(7)
    expect(process.reason).toBe('Error')
  })

  it('keeps sleep infinity running', () => {
    vi.useFakeTimers()
    const runtime = createContainerProcessRuntime()
    runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'infinite-pod',
      containerName: 'main',
      command: ['sleep', 'infinity']
    })
    vi.advanceTimersByTime(120000)
    const process = runtime.getMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'infinite-pod',
      containerName: 'main'
    })
    expect(process?.state).toBe('Running')
    vi.useRealTimers()
  })

  it('filters and clears pod process records', () => {
    const runtime = createContainerProcessRuntime()
    runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'pod-a',
      containerName: 'main',
      command: ['sleep', '3600']
    })
    runtime.ensureMainProcess({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'pod-b',
      containerName: 'main',
      command: ['sleep', '3600']
    })
    const before = runtime.listProcesses({ namespace: 'default' })
    expect(before).toHaveLength(2)
    runtime.clearPodProcesses({
      nodeName: 'worker-1',
      namespace: 'default',
      podName: 'pod-a'
    })
    const after = runtime.listProcesses({ namespace: 'default' })
    expect(after).toHaveLength(1)
    expect(after[0]?.podName).toBe('pod-b')
  })
})
