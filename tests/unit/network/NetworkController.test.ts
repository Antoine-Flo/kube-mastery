import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createService } from '../../../src/core/cluster/ressources/Service'
import { createNetworkController } from '../../../src/core/network/NetworkController'

const settleReconciliation = async (): Promise<void> => {
  for (let index = 0; index < 6; index++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

describe('NetworkController', () => {
  it('should allocate clusterIP and nodePort and build endpoints', async () => {
    const apiServer = createApiServerFacade()
    const controller = createNetworkController(apiServer)

    apiServer.createResource(
      'Pod',
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
    apiServer.createResource(
      'Service',
      createService({
        name: 'web',
        namespace: 'default',
        type: 'NodePort',
        selector: { app: 'web' },
        ports: [{ port: 80, targetPort: 8080 }]
      })
    )

    controller.start()
    await settleReconciliation()

    const serviceResult = apiServer.findResource('Service', 'web', 'default')
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

  it('should remove endpoints when selected pod is deleted', async () => {
    const apiServer = createApiServerFacade()
    const controller = createNetworkController(apiServer)

    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-1',
        namespace: 'default',
        labels: { app: 'web' },
        phase: 'Running',
        podIP: '10.244.20.20',
        containers: [{ name: 'web', image: 'nginx' }]
      })
    )
    apiServer.createResource(
      'Service',
      createService({
        name: 'web',
        namespace: 'default',
        selector: { app: 'web' },
        ports: [{ port: 80 }]
      })
    )

    controller.start()
    await settleReconciliation()
    apiServer.deleteResource('Pod', 'web-1', 'default')
    await settleReconciliation()

    const runtime = controller.getState().getServiceRuntime('default', 'web')
    expect(runtime).toBeDefined()
    if (runtime != null) {
      expect(runtime.endpoints.length).toBe(0)
    }

    controller.stop()
  })
})
