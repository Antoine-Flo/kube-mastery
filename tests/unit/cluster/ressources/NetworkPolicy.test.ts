import { describe, expect, it } from 'vitest'
import {
  createNetworkPolicy,
  parseNetworkPolicyManifest
} from '../../../../src/core/cluster/ressources/NetworkPolicy'

describe('NetworkPolicy', () => {
  it('parseNetworkPolicyManifest accepts deny-all ingress lesson manifest', () => {
    const manifest = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: {
        name: 'deny-all-ingress-to-backend',
        namespace: 'default'
      },
      spec: {
        podSelector: {
          matchLabels: {
            app: 'backend'
          }
        },
        policyTypes: ['Ingress'],
        ingress: []
      }
    }
    const result = parseNetworkPolicyManifest(manifest)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.spec.policyTypes).toEqual(['Ingress'])
    expect(result.value.spec.ingress).toEqual([])
    expect(result.value.spec.podSelector).toEqual({
      matchLabels: { app: 'backend' }
    })
  })

  it('parseNetworkPolicyManifest accepts empty podSelector', () => {
    const manifest = {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'NetworkPolicy',
      metadata: { name: 'wide', namespace: 'default' },
      spec: {
        podSelector: {},
        policyTypes: ['Ingress'],
        ingress: []
      }
    }
    const result = parseNetworkPolicyManifest(manifest)
    expect(result.ok).toBe(true)
  })

  it('createNetworkPolicy freezes object', () => {
    const policy = createNetworkPolicy({
      name: 'p',
      namespace: 'default',
      spec: { policyTypes: ['Egress'], egress: [] }
    })
    expect(policy.kind).toBe('NetworkPolicy')
    expect(() => {
      ;(policy as { metadata: { name: string } }).metadata.name = 'x'
    }).toThrow()
  })
})
