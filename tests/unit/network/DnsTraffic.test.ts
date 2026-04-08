import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createService } from '../../../src/core/cluster/ressources/Service'
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
    const result = resolver.resolveARecord(
      'web.dev.svc.cluster.local',
      'default'
    )
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
          targetPort: 8080,
          responseProfile: 'nginx'
        }
      ]
    })

    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-abc',
        namespace: 'dev',
        phase: 'Running',
        containers: [{ name: 'web', image: 'nginx:latest' }]
      })
    )
    const resolver = createDnsResolver(networkState)
    const traffic = createTrafficEngine(networkState, resolver, apiServer)

    const clusterIpResult = traffic.simulateHttpGet('http://10.96.11.21:80', {
      sourceNamespace: 'dev'
    })
    expect(clusterIpResult.ok).toBe(true)
    if (clusterIpResult.ok) {
      expect(clusterIpResult.value).toContain(
        '<title>Welcome to nginx!</title>'
      )
    }

    const nodePortResult = traffic.simulateHttpGet('http://172.18.0.2:30080', {
      sourceNamespace: 'dev'
    })
    expect(nodePortResult.ok).toBe(true)
    if (nodePortResult.ok) {
      expect(nodePortResult.value).toContain('<h1>Welcome to nginx!</h1>')
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

    const apiServer = createApiServerFacade()
    const resolver = createDnsResolver(networkState)
    const traffic = createTrafficEngine(networkState, resolver, apiServer)
    const result = traffic.simulateHttpGet('http://web.dev.svc.cluster.local', {
      sourceNamespace: 'dev'
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Empty reply')
    }
  })

  it('should resolve pod IP based DNS record', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'mypod',
        namespace: 'default',
        labels: {
          app: 'demo'
        },
        podIP: '10.244.7.11',
        phase: 'Running',
        containers: [
          {
            name: 'mypod',
            image: 'busybox:1.36'
          }
        ]
      })
    )
    const resolver = createDnsResolver(createNetworkState(), apiServer)
    const result = resolver.resolveARecord(
      '10-244-7-11.default.pod.cluster.local',
      'default'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.addresses).toEqual(['10.244.7.11'])
  })

  it('should resolve headless StatefulSet style pod DNS record', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Service',
      createService({
        name: 'db',
        namespace: 'default',
        clusterIP: 'None',
        selector: {
          app: 'db'
        },
        ports: [
          {
            port: 5432
          }
        ]
      })
    )
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'db-0',
        namespace: 'default',
        labels: {
          app: 'db'
        },
        podIP: '10.244.9.22',
        phase: 'Running',
        containers: [
          {
            name: 'db',
            image: 'nginx:latest'
          }
        ]
      })
    )
    const resolver = createDnsResolver(createNetworkState(), apiServer)
    const result = resolver.resolveARecord(
      'db-0.db.default.svc.cluster.local',
      'default'
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.addresses).toEqual(['10.244.9.22'])
  })
})
