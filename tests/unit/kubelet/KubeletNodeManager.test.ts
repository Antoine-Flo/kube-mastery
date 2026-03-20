import { describe, expect, it } from 'vitest'
import { createKubeletNodeManager } from '../../../src/core/kubelet/KubeletNodeManager'
import { createContainerRuntimeSimulator } from '../../../src/core/runtime/ContainerRuntimeSimulator'
import type { ControlPlaneControllers } from '../../../src/core/control-plane/initializers'
import type { Controller } from '../../../src/core/control-plane/controller-runtime/types'

const createNoopController = (): Controller => {
  return {
    start: () => {},
    stop: () => {},
    reconcile: () => {}
  }
}

const createControllers = (): ControlPlaneControllers => {
  const controller = createNoopController()
  return {
    deploymentController: controller,
    daemonSetController: controller,
    replicaSetController: controller,
    schedulerController: controller,
    podLifecycleController: controller,
    podTerminationController: controller
  }
}

describe('KubeletNodeManager', () => {
  it('tracks known nodes and container listing per node', () => {
    const runtime = createContainerRuntimeSimulator()
    runtime.startContainer({
      nodeName: 'worker-a',
      namespace: 'default',
      podName: 'web',
      containerName: 'nginx',
      image: 'nginx:latest'
    })

    const manager = createKubeletNodeManager(createControllers(), runtime, {
      initialNodeNames: ['worker-a']
    })
    manager.ensureNode('worker-b')

    expect(manager.hasNode('worker-a')).toBe(true)
    expect(manager.hasNode('worker-b')).toBe(true)
    expect(manager.listNodes()).toEqual(['worker-a', 'worker-b'])
    expect(manager.listNodeContainers('worker-a')).toHaveLength(1)
    expect(manager.listNodeContainers('worker-b')).toHaveLength(0)
  })

  it('clears registered nodes on stop', () => {
    const manager = createKubeletNodeManager(
      createControllers(),
      createContainerRuntimeSimulator(),
      { initialNodeNames: ['worker-a'] }
    )

    manager.stop()
    expect(manager.listNodes()).toEqual([])
  })
})
