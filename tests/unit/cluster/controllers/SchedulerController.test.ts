import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import {
  createNode,
  type NodeStatus
} from '../../../../src/core/cluster/ressources/Node'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createSchedulerController } from '../../../../src/core/control-plane/controllers/SchedulerController'

const READY_NODE_STATUS: NodeStatus = {
  nodeInfo: {
    architecture: 'amd64',
    containerRuntimeVersion: 'containerd://1.7.0',
    kernelVersion: '6.1.0',
    kubeletVersion: 'v1.29.0',
    operatingSystem: 'linux',
    osImage: 'Fedora'
  },
  conditions: [{ type: 'Ready', status: 'True' }]
}

describe('SchedulerController placement strategy', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('places a new ReplicaSet pod on the least loaded eligible node', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade({
      bootstrap: { profile: 'none', mode: 'never' }
    })

    // Intentionally create n2 first to ensure we do not depend on node list order.
    apiServer.createResource(
      'Node',
      createNode({
        name: 'n2',
        labels: { 'node-role.kubernetes.io/worker': '' },
        status: READY_NODE_STATUS
      })
    )
    apiServer.createResource(
      'Node',
      createNode({
        name: 'n1',
        labels: { 'node-role.kubernetes.io/worker': '' },
        status: READY_NODE_STATUS
      })
    )

    apiServer.createResource(
      'Pod',
      createPod({
        name: 'rs-pod-existing',
        namespace: 'default',
        nodeName: 'n2',
        phase: 'Running',
        labels: { app: 'web' },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'ReplicaSet',
            name: 'web-rs',
            uid: 'rs-web-uid',
            controller: true
          }
        ],
        containers: [{ name: 'web', image: 'nginx:latest' }]
      })
    )
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'rs-pod-replacement',
        namespace: 'default',
        phase: 'Pending',
        labels: { app: 'web' },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'ReplicaSet',
            name: 'web-rs',
            uid: 'rs-web-uid',
            controller: true
          }
        ],
        containers: [{ name: 'web', image: 'nginx:latest' }]
      })
    )

    const schedulerController = createSchedulerController(apiServer, {
      schedulingDelayRangeMs: { minMs: 0, maxMs: 0 }
    })

    vi.runAllTimers()

    const replacementResult = apiServer.findResource(
      'Pod',
      'rs-pod-replacement',
      'default'
    )
    expect(replacementResult.ok).toBe(true)
    if (!replacementResult.ok || replacementResult.value == null) {
      schedulerController.stop()
      return
    }
    expect(replacementResult.value.spec.nodeName).toBe('n1')

    schedulerController.stop()
  })
})
