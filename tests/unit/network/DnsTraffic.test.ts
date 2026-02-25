import { describe, expect, it } from 'vitest'
import { createDnsResolver } from '../../../src/core/network/DnsResolver'
import { createNetworkState } from '../../../src/core/network/NetworkState'
import { createTrafficEngine } from '../../../src/core/network/TrafficEngine'

describe('Network DNS and Traffic', () => {
  it('should resolve service FQDN to ClusterIP', () => {
    const networkState = createNetworkState()
    networkState.upsertServiceRuntime({
      namespace: 'dev',
      serviceName: 'web',
      serviceType: 'ClusterIP',
      clusterIP: '10.96.10.20',
      ports: [
        {
          protocol: 'TCP',
          port: 80,
          targetPort: 8080
        }
      ],
      endpoints: []
    })

    const resolver = createDnsResolver(networkState)
    const result = resolver.resolveARecord('web.dev.svc.cluster.local', 'default')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.addresses).toEqual(['10.96.10.20'])
  })

  it('should route curl through clusterIP and nodePort', () => {
    const networkState = createNetworkState()
    networkState.upsertServiceRuntime({
      namespace: 'dev',
      serviceName: 'web',
      serviceType: 'NodePort',
      clusterIP: '10.96.11.21',
      ports: [
        {
          protocol: 'TCP',
          port: 80,
          targetPort: 8080,
          nodePort: 30080
        }
      ],
      endpoints: [
        {
          podName: 'web-abc',
          namespace: 'dev',
          podIP: '10.244.1.12',
          targetPort: 8080
        }
      ]
    })

    const resolver = createDnsResolver(networkState)
    const traffic = createTrafficEngine(networkState, resolver)

    const clusterIpResult = traffic.simulateHttpGet('http://10.96.11.21:80', {
      sourceNamespace: 'dev'
    })
    expect(clusterIpResult.ok).toBe(true)
    if (clusterIpResult.ok) {
      expect(clusterIpResult.value).toContain('CLUSTERIP 200 OK')
    }

    const nodePortResult = traffic.simulateHttpGet('http://172.18.0.2:30080', {
      sourceNamespace: 'dev'
    })
    expect(nodePortResult.ok).toBe(true)
    if (nodePortResult.ok) {
      expect(nodePortResult.value).toContain('NODEPORT 200 OK')
    }
  })

  it('should fail curl when service has no endpoints', () => {
    const networkState = createNetworkState()
    networkState.upsertServiceRuntime({
      namespace: 'dev',
      serviceName: 'web',
      serviceType: 'ClusterIP',
      clusterIP: '10.96.12.22',
      ports: [
        {
          protocol: 'TCP',
          port: 80,
          targetPort: 8080
        }
      ],
      endpoints: []
    })

    const resolver = createDnsResolver(networkState)
    const traffic = createTrafficEngine(networkState, resolver)
    const result = traffic.simulateHttpGet('http://web.dev.svc.cluster.local', {
      sourceNamespace: 'dev'
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Empty reply')
    }
  })
})
