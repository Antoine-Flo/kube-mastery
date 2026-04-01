import { describe, expect, it } from 'vitest'
import { createIngress } from '~/core/cluster/ressources/Ingress'
import { createService } from '~/core/cluster/ressources/Service'
import {
  formatIngressClass,
  formatIngressHosts,
  formatIngressPorts,
  formatNodeSelector,
  formatServicePorts,
  getSecretType,
  getServiceExternalIP
} from '~/core/kubectl/commands/handlers/internal/get/resourceFormatters'

describe('resourceFormatters', () => {
  it('returns secret type literal', () => {
    expect(getSecretType({ type: 'Opaque' })).toBe('Opaque')
  })

  it('formats service external IP from loadBalancer ip', () => {
    const service = createService({
      name: 'web',
      namespace: 'default',
      ports: [{ port: 80 }],
      status: {
        loadBalancer: {
          ingress: [{ ip: '35.1.2.3' }]
        }
      }
    })
    expect(getServiceExternalIP(service)).toBe('35.1.2.3')
  })

  it('formats service external IP from loadBalancer hostname', () => {
    const service = createService({
      name: 'web',
      namespace: 'default',
      ports: [{ port: 80 }],
      status: {
        loadBalancer: {
          ingress: [{ hostname: 'lb.kubemastery.local' }]
        }
      }
    })
    expect(getServiceExternalIP(service)).toBe('lb.kubemastery.local')
  })

  it('returns pending for empty loadBalancer ingress entry', () => {
    const service = createService({
      name: 'web',
      namespace: 'default',
      ports: [{ port: 80 }],
      status: {
        loadBalancer: {
          ingress: [{}]
        }
      }
    })
    expect(getServiceExternalIP(service)).toBe('<pending>')
  })

  it('returns pending for loadbalancer service without ingress yet', () => {
    const service = createService({
      name: 'web-lb',
      namespace: 'default',
      type: 'LoadBalancer',
      ports: [{ port: 80 }]
    })
    expect(getServiceExternalIP(service)).toBe('<pending>')
  })

  it('falls back to externalIPs then none', () => {
    const withExternalIps = createService({
      name: 'web',
      namespace: 'default',
      ports: [{ port: 80 }],
      externalIPs: ['10.0.0.9', '10.0.0.10']
    })
    expect(getServiceExternalIP(withExternalIps)).toBe('10.0.0.9,10.0.0.10')

    const noExternalIp = createService({
      name: 'api',
      namespace: 'default',
      ports: [{ port: 443 }]
    })
    expect(getServiceExternalIP(noExternalIp)).toBe('<none>')
  })

  it('formats service ports with nodePort and default protocol', () => {
    const service = createService({
      name: 'node',
      namespace: 'default',
      ports: [
        { port: 80, nodePort: 30080, protocol: 'TCP' },
        { port: 53, protocol: 'UDP' }
      ]
    })
    expect(formatServicePorts(service)).toBe('80:30080/TCP,53/UDP')
  })

  it('returns <none> when service has no ports', () => {
    const service = createService({
      name: 'broken',
      namespace: 'default',
      ports: []
    })
    expect(formatServicePorts(service)).toBe('<none>')
  })

  it('formats ingress class and hosts', () => {
    const ingress = createIngress({
      name: 'ing',
      namespace: 'default',
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: 'app.local',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web', port: { number: 80 } }
                  }
                }
              ]
            }
          },
          {
            host: '',
            http: {
              paths: [
                {
                  path: '/health',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web', port: { number: 80 } }
                  }
                }
              ]
            }
          }
        ]
      }
    })
    expect(formatIngressClass(ingress)).toBe('nginx')
    expect(formatIngressHosts(ingress)).toBe('app.local')
    expect(formatIngressPorts()).toBe('80')
  })

  it('returns defaults for ingress class and host wildcard', () => {
    const ingress = createIngress({
      name: 'no-host',
      namespace: 'default',
      spec: {
        rules: [
          {
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web', port: { number: 80 } }
                  }
                }
              ]
            }
          }
        ]
      }
    })
    expect(formatIngressClass(ingress)).toBe('<none>')
    expect(formatIngressHosts(ingress)).toBe('*')
  })

  it('sorts node selector keys and handles empty selectors', () => {
    expect(formatNodeSelector({ zone: 'a', app: 'web' })).toBe('app=web,zone=a')
    expect(formatNodeSelector({})).toBe('<none>')
    expect(formatNodeSelector(undefined)).toBe('<none>')
  })
})
