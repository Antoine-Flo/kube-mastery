import { describe, expect, it } from 'vitest'
import { createContainerRuntimeSimulator } from '../../../src/core/runtime/ContainerRuntimeSimulator'

describe('ContainerRuntimeSimulator', () => {
  it('starts and lists running containers', () => {
    const runtime = createContainerRuntimeSimulator()
    const record = runtime.startContainer({
      nodeName: 'worker-a',
      namespace: 'default',
      podName: 'web',
      containerName: 'nginx',
      image: 'nginx:latest'
    })

    expect(record.state).toBe('Running')
    expect(runtime.getRuntimeId()).toBe('containerd://2.2.0')
    expect(runtime.getContainerCount()).toBe(1)
    expect(runtime.listContainers({ nodeName: 'worker-a' })).toHaveLength(1)
  })

  it('stops container and stores termination details', () => {
    const runtime = createContainerRuntimeSimulator()
    const started = runtime.startContainer({
      nodeName: 'worker-a',
      namespace: 'default',
      podName: 'web',
      containerName: 'nginx',
      image: 'nginx:latest'
    })

    const stopped = runtime.stopContainer({
      containerId: started.containerId,
      exitCode: 137,
      reason: 'Killed'
    })

    expect(stopped?.state).toBe('Terminated')
    expect(stopped?.exitCode).toBe(137)
    expect(stopped?.reason).toBe('Killed')
    expect(stopped?.finishedAt).toBeDefined()
    expect(runtime.listContainers({ state: 'Terminated' })).toHaveLength(1)
  })
})
