import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createNetworkPolicy } from '../../../src/core/cluster/ressources/NetworkPolicy'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createDnsResolver } from '../../../src/core/network/DnsResolver'
import { createNetworkState } from '../../../src/core/network/NetworkState'
import { createTrafficEngine } from '../../../src/core/network/TrafficEngine'

describe('TrafficEngine with NetworkPolicy', () => {
  it('denies simulateHttpGet when ingress is default-deny for backend pod', () => {
    const networkState = createNetworkState()
    networkState.upsertServiceRuntime({
      namespace: 'default',
      serviceName: 'web',
      serviceType: 'ClusterIP',
      clusterIP: '10.96.20.20',
      ports: [{ protocol: 'TCP', port: 80, targetPort: 8080 }],
      endpoints: [
        {
          podName: 'web-1',
          namespace: 'default',
          podIP: '10.244.1.1',
          targetPort: 8080,
          responseProfile: 'nginx'
        }
      ]
    })

    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-1',
        namespace: 'default',
        labels: { app: 'web' },
        phase: 'Running',
        containers: [{ name: 'web', image: 'nginx:latest' }]
      })
    )
    apiServer.createResource(
      'NetworkPolicy',
      createNetworkPolicy({
        name: 'isolate-web',
        namespace: 'default',
        spec: {
          podSelector: { matchLabels: { app: 'web' } },
          policyTypes: ['Ingress'],
          ingress: []
        }
      })
    )

    const resolver = createDnsResolver(networkState, apiServer)
    const traffic = createTrafficEngine(networkState, resolver, apiServer)

    const result = traffic.simulateHttpGet('http://10.96.20.20:80', {
      sourceNamespace: 'default',
      sourcePod: {
        name: 'client',
        namespace: 'default',
        labels: { app: 'other' }
      }
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Failed to connect')
    }
  })

  it('allows simulateHttpGet when ingress rule matches source and port', () => {
    const networkState = createNetworkState()
    networkState.upsertServiceRuntime({
      namespace: 'default',
      serviceName: 'web',
      serviceType: 'ClusterIP',
      clusterIP: '10.96.20.21',
      ports: [{ protocol: 'TCP', port: 80, targetPort: 8080 }],
      endpoints: [
        {
          podName: 'web-1',
          namespace: 'default',
          podIP: '10.244.1.2',
          targetPort: 8080,
          responseProfile: 'nginx'
        }
      ]
    })

    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-1',
        namespace: 'default',
        labels: { app: 'web' },
        phase: 'Running',
        containers: [{ name: 'web', image: 'nginx:latest' }]
      })
    )
    apiServer.createResource(
      'NetworkPolicy',
      createNetworkPolicy({
        name: 'allow-client',
        namespace: 'default',
        spec: {
          podSelector: { matchLabels: { app: 'web' } },
          policyTypes: ['Ingress'],
          ingress: [
            {
              from: [{ podSelector: { matchLabels: { app: 'client' } } }],
              ports: [{ protocol: 'TCP', port: 8080 }]
            }
          ]
        }
      })
    )

    const resolver = createDnsResolver(networkState, apiServer)
    const traffic = createTrafficEngine(networkState, resolver, apiServer)

    const result = traffic.simulateHttpGet('http://10.96.20.21:80', {
      sourceNamespace: 'default',
      sourcePod: {
        name: 'curl-pod',
        namespace: 'default',
        labels: { app: 'client' }
      }
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('Welcome to nginx')
    }
  })
})
