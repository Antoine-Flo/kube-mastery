import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createService } from '../../../src/core/cluster/ressources/Service'
import { createNetworkController } from '../../../src/core/network/NetworkController'

describe('NetworkController', () => {
  it('should allocate clusterIP and nodePort and build endpoints', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const controller = createNetworkController(eventBus, clusterState)

    clusterState.addPod(
      createPod({
        name: 'web-1',
        namespace: 'default',
        labels: { app: 'web' },
        phase: 'Running',
        podIP: '10.244.10.10',
        containers: [
          {
            name: 'web',
            image: 'nginx',
            ports: [{ containerPort: 8080 }]
          }
        ]
      })
    )
    clusterState.addService(
      createService({
        name: 'web',
        namespace: 'default',
        type: 'NodePort',
        selector: { app: 'web' },
        ports: [{ port: 80, targetPort: 8080 }]
      })
    )

    controller.start()

    const serviceResult = clusterState.findService('web', 'default')
    expect(serviceResult.ok).toBe(true)
    if (!serviceResult.ok) {
      controller.stop()
      return
    }

    expect(serviceResult.value.spec.clusterIP).toBeDefined()
    expect(serviceResult.value.spec.ports[0].nodePort).toBeDefined()

    const runtime = controller.getState().getServiceRuntime('default', 'web')
    expect(runtime).toBeDefined()
    if (runtime != null) {
      expect(runtime.endpoints.length).toBe(1)
      expect(runtime.endpoints[0].podIP).toBe('10.244.10.10')
    }

    controller.stop()
  })

  it('should remove endpoints when selected pod is deleted', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const controller = createNetworkController(eventBus, clusterState)

    clusterState.addPod(
      createPod({
        name: 'web-1',
        namespace: 'default',
        labels: { app: 'web' },
        phase: 'Running',
        podIP: '10.244.20.20',
        containers: [{ name: 'web', image: 'nginx' }]
      })
    )
    clusterState.addService(
      createService({
        name: 'web',
        namespace: 'default',
        selector: { app: 'web' },
        ports: [{ port: 80 }]
      })
    )

    controller.start()
    clusterState.deletePod('web-1', 'default')

    const runtime = controller.getState().getServiceRuntime('default', 'web')
    expect(runtime).toBeDefined()
    if (runtime != null) {
      expect(runtime.endpoints.length).toBe(0)
    }

    controller.stop()
  })
})
