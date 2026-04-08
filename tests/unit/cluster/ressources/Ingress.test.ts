import { describe, expect, it } from 'vitest'
import { parseIngressManifest } from '../../../../src/core/cluster/ressources/Ingress'

describe('parseIngressManifest', () => {
  it('accepts defaultBackend only when rules are omitted', () => {
    const result = parseIngressManifest({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name: 'edge', namespace: 'default' },
      spec: {
        defaultBackend: {
          service: {
            name: 'fallback-svc',
            port: { number: 8080 }
          }
        }
      }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.spec.rules).toBeUndefined()
    expect(result.value.spec.defaultBackend?.service?.name).toBe('fallback-svc')
  })

  it('accepts tls alongside rules', () => {
    const result = parseIngressManifest({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name: 'tls-ing', namespace: 'prod' },
      spec: {
        rules: [
          {
            host: 'app.example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'web',
                      port: { name: 'http' }
                    }
                  }
                }
              ]
            }
          }
        ],
        tls: [
          { hosts: ['app.example.com'], secretName: 'app-tls' },
          { secretName: 'wildcard-tls' }
        ]
      }
    })
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.spec.tls).toHaveLength(2)
    expect(result.value.spec.tls?.[0].secretName).toBe('app-tls')
    expect(result.value.spec.tls?.[1].hosts).toBeUndefined()
  })

  it('rejects spec with neither rules nor defaultBackend', () => {
    const result = parseIngressManifest({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name: 'bad', namespace: 'default' },
      spec: {
        ingressClassName: 'nginx'
      }
    })
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('at least one rule or defaultBackend')
  })

  it('rejects rules entry missing http', () => {
    const result = parseIngressManifest({
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name: 'bad-rules', namespace: 'default' },
      spec: {
        rules: [{ host: 'x.example.com' }]
      }
    })
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('http')
  })
})
