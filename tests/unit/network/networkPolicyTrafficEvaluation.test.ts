import { describe, expect, it } from 'vitest'
import type { NetworkPolicy } from '../../../src/core/cluster/ressources/NetworkPolicy'
import { createNetworkPolicy } from '../../../src/core/cluster/ressources/NetworkPolicy'
import {
  evaluateSimulatedPodTraffic,
  getEffectiveNetworkPolicyTypes,
  networkPolicyPodSelectorMatchesLabels
} from '../../../src/core/network/networkPolicyTrafficEvaluation'

const denyMessage = (host: string, port: number): string => {
  return `curl: (7) Failed to connect to ${host} port ${port}`
}

describe('networkPolicyPodSelectorMatchesLabels', () => {
  it('matches all pods when selector is empty or undefined', () => {
    expect(networkPolicyPodSelectorMatchesLabels(undefined, {})).toBe(true)
    expect(networkPolicyPodSelectorMatchesLabels({}, { app: 'x' })).toBe(true)
  })

  it('matches matchLabels subset', () => {
    expect(
      networkPolicyPodSelectorMatchesLabels(
        { matchLabels: { app: 'web' } },
        { app: 'web', tier: 'fe' }
      )
    ).toBe(true)
    expect(
      networkPolicyPodSelectorMatchesLabels(
        { matchLabels: { app: 'web' } },
        { app: 'api' }
      )
    ).toBe(false)
  })
})

describe('getEffectiveNetworkPolicyTypes', () => {
  it('uses explicit policyTypes when set', () => {
    const types = getEffectiveNetworkPolicyTypes({
      policyTypes: ['Egress'],
      ingress: [{ from: [] }]
    })
    expect([...types]).toEqual(['Egress'])
  })

  it('infers from ingress and egress keys', () => {
    expect([...getEffectiveNetworkPolicyTypes({ ingress: [] })].sort()).toEqual(
      ['Ingress']
    )
    expect([...getEffectiveNetworkPolicyTypes({ egress: [] })].sort()).toEqual([
      'Egress'
    ])
    expect(
      [...getEffectiveNetworkPolicyTypes({ ingress: [], egress: [] })].sort()
    ).toEqual(['Egress', 'Ingress'])
  })

  it('defaults to Ingress when no keys and no policyTypes', () => {
    expect([...getEffectiveNetworkPolicyTypes({})]).toEqual(['Ingress'])
  })
})

describe('evaluateSimulatedPodTraffic', () => {
  const baseInput = {
    policiesInTargetNamespace: [] as NetworkPolicy[],
    policiesInSourceNamespace: [] as NetworkPolicy[],
    sourcePod: {
      name: 'fe',
      namespace: 'default',
      labels: { app: 'frontend' }
    },
    targetPod: {
      name: 'be',
      namespace: 'default',
      labels: { app: 'backend' }
    },
    protocol: 'TCP',
    targetContainerPort: 8080,
    curlErrorHost: 'be-svc',
    urlPort: 80
  }

  it('allows traffic when no policy selects either pod', () => {
    const result = evaluateSimulatedPodTraffic(baseInput)
    expect(result.ok).toBe(true)
  })

  it('denies ingress when policy selects target with Ingress and empty ingress rules', () => {
    const policy = createNetworkPolicy({
      name: 'deny-in',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: []
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [policy]
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe(denyMessage('be-svc', 80))
    }
  })

  it('allows ingress when rule matches source labels and port', () => {
    const policy = createNetworkPolicy({
      name: 'allow-fe',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [
          {
            from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [policy]
    })
    expect(result.ok).toBe(true)
  })

  it('denies ingress when port on rule does not match container port', () => {
    const policy = createNetworkPolicy({
      name: 'wrong-port',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [
          {
            from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
            ports: [{ protocol: 'TCP', port: 9090 }]
          }
        ]
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [policy]
    })
    expect(result.ok).toBe(false)
  })

  it('unions allow rules across multiple policies', () => {
    const p1 = createNetworkPolicy({
      name: 'a',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [
          {
            from: [{ podSelector: { matchLabels: { app: 'wrong' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const p2 = createNetworkPolicy({
      name: 'b',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [
          {
            from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [p1, p2]
    })
    expect(result.ok).toBe(true)
  })

  it('denies egress when policy selects source with Egress and empty egress', () => {
    const policy = createNetworkPolicy({
      name: 'deny-out',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'frontend' } },
        policyTypes: ['Egress'],
        egress: []
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInSourceNamespace: [policy]
    })
    expect(result.ok).toBe(false)
  })

  it('allows when ingress restricted but sourcePod absent and rule has empty from', () => {
    const policy = createNetworkPolicy({
      name: 'open-ingress',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [{ ports: [{ protocol: 'TCP', port: 8080 }] }]
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [policy],
      sourcePod: undefined
    })
    expect(result.ok).toBe(true)
  })

  it('denies when ingress restricted and sourcePod absent and from requires podSelector', () => {
    const policy = createNetworkPolicy({
      name: 'locked',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [
          {
            from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [policy],
      sourcePod: undefined
    })
    expect(result.ok).toBe(false)
  })

  it('requires both ingress and egress when both directions restricted', () => {
    const ingressPol = createNetworkPolicy({
      name: 'in',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [
          {
            from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const egressPol = createNetworkPolicy({
      name: 'out',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'frontend' } },
        policyTypes: ['Egress'],
        egress: [
          {
            to: [{ podSelector: { matchLabels: { app: 'wrong' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [ingressPol],
      policiesInSourceNamespace: [egressPol]
    })
    expect(result.ok).toBe(false)
  })

  it('allows when egress policy allows target pod', () => {
    const ingressPol = createNetworkPolicy({
      name: 'in',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'backend' } },
        policyTypes: ['Ingress'],
        ingress: [
          {
            from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const egressPol = createNetworkPolicy({
      name: 'out',
      namespace: 'default',
      spec: {
        podSelector: { matchLabels: { app: 'frontend' } },
        policyTypes: ['Egress'],
        egress: [
          {
            to: [{ podSelector: { matchLabels: { app: 'backend' } } }],
            ports: [{ protocol: 'TCP', port: 8080 }]
          }
        ]
      }
    })
    const result = evaluateSimulatedPodTraffic({
      ...baseInput,
      policiesInTargetNamespace: [ingressPol],
      policiesInSourceNamespace: [egressPol]
    })
    expect(result.ok).toBe(true)
  })
})
