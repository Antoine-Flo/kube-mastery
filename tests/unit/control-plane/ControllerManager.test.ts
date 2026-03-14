import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createNode } from '../../../src/core/cluster/ressources/Node'
import { startControlPlaneRuntime } from '../../../src/core/control-plane/ControllerManager'

describe('ControllerManager', () => {
  it('synchronizes node runtime version with container runtime', () => {
    const apiServer = createApiServerFacade({
      bootstrap: { profile: 'none', mode: 'never' }
    })
    apiServer.createResource(
      'Node',
      createNode({
        name: 'worker-a',
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://1.6.0',
            kernelVersion: '6.1.0',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Debian GNU/Linux 12 (bookworm)'
          },
          conditions: [{ type: 'Ready', status: 'True' }]
        }
      })
    )

    const runtime = startControlPlaneRuntime(apiServer, {
      deployment: { resyncIntervalMs: 60_000 },
      daemonSet: { resyncIntervalMs: 60_000 },
      replicaSet: { resyncIntervalMs: 60_000 },
      scheduler: { resyncIntervalMs: 60_000 },
      podLifecycle: { resyncIntervalMs: 60_000 }
    })

    const nodeResult = apiServer.findResource('Node', 'worker-a')
    expect(nodeResult.ok).toBe(true)
    if (!nodeResult.ok || nodeResult.value == null) {
      runtime.stop()
      return
    }
    expect(nodeResult.value.status.nodeInfo.containerRuntimeVersion).toBe(
      runtime.containerRuntime.getRuntimeId()
    )

    runtime.stop()
  })
})
