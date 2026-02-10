// ═══════════════════════════════════════════════════════════════════════════
// REPLICASET UNIT TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Tests for ReplicaSet factory, parser, and helper functions

import { describe, expect, it } from 'vitest'
import {
  createReplicaSet,
  getReplicaSetDesiredReplicas,
  getReplicaSetReadyDisplay,
  parseReplicaSetManifest,
  selectorMatchesLabels
} from '../../../../src/core/cluster/ressources/ReplicaSet'

describe('createReplicaSet', () => {
  it('should create ReplicaSet with required fields', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      replicas: 3,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })

    expect(rs.apiVersion).toBe('apps/v1')
    expect(rs.kind).toBe('ReplicaSet')
    expect(rs.metadata.name).toBe('nginx-rs')
    expect(rs.metadata.namespace).toBe('default')
    expect(rs.spec.replicas).toBe(3)
    expect(rs.spec.selector.matchLabels).toEqual({ app: 'nginx' })
    expect(rs.spec.template.spec.containers[0].name).toBe('nginx')
  })

  it('should default replicas to 1 if not specified', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })

    expect(rs.spec.replicas).toBe(1)
  })

  it('should initialize status with zeros', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      replicas: 3,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })

    expect(rs.status.replicas).toBe(0)
    expect(rs.status.readyReplicas).toBe(0)
    expect(rs.status.availableReplicas).toBe(0)
  })

  it('should include ownerReferences if provided', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      },
      ownerReferences: [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: 'nginx-deployment',
          uid: 'default-nginx-deployment',
          controller: true
        }
      ]
    })

    expect(rs.metadata.ownerReferences).toHaveLength(1)
    expect(rs.metadata.ownerReferences![0].kind).toBe('Deployment')
    expect(rs.metadata.ownerReferences![0].name).toBe('nginx-deployment')
  })

  it('should include labels if provided', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        metadata: { labels: { app: 'nginx' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      },
      labels: { app: 'nginx', version: 'v1' }
    })

    expect(rs.metadata.labels).toEqual({ app: 'nginx', version: 'v1' })
  })
})

describe('parseReplicaSetManifest', () => {
  it('should parse valid minimal ReplicaSet manifest', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: {
        name: 'nginx-rs',
        namespace: 'default'
      },
      spec: {
        replicas: 2,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:latest' }]
          }
        }
      }
    }

    const result = parseReplicaSetManifest(manifest)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.metadata.name).toBe('nginx-rs')
      expect(result.value.spec.replicas).toBe(2)
    }
  })

  it('should reject manifest with invalid apiVersion', () => {
    const manifest = {
      apiVersion: 'v1', // Invalid for ReplicaSet
      kind: 'ReplicaSet',
      metadata: { name: 'test' },
      spec: {
        selector: { matchLabels: { app: 'test' } },
        template: {
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
        }
      }
    }

    const result = parseReplicaSetManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('should reject manifest without containers', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: { name: 'test' },
      spec: {
        selector: { matchLabels: { app: 'test' } },
        template: {
          spec: { containers: [] }
        }
      }
    }

    const result = parseReplicaSetManifest(manifest)
    expect(result.ok).toBe(false)
  })

  it('should default namespace to "default"', () => {
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'ReplicaSet',
      metadata: { name: 'nginx-rs' },
      spec: {
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
        }
      }
    }

    const result = parseReplicaSetManifest(manifest)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.metadata.namespace).toBe('default')
    }
  })
})

describe('selectorMatchesLabels', () => {
  it('should match when all matchLabels are present', () => {
    const selector = { matchLabels: { app: 'nginx', tier: 'frontend' } }
    const labels = { app: 'nginx', tier: 'frontend', version: 'v1' }

    expect(selectorMatchesLabels(selector, labels)).toBe(true)
  })

  it('should not match when a label is missing', () => {
    const selector = { matchLabels: { app: 'nginx', tier: 'frontend' } }
    const labels = { app: 'nginx' }

    expect(selectorMatchesLabels(selector, labels)).toBe(false)
  })

  it('should not match when a label value differs', () => {
    const selector = { matchLabels: { app: 'nginx' } }
    const labels = { app: 'redis' }

    expect(selectorMatchesLabels(selector, labels)).toBe(false)
  })

  it('should return false for undefined labels', () => {
    const selector = { matchLabels: { app: 'nginx' } }

    expect(selectorMatchesLabels(selector, undefined)).toBe(false)
  })

  it('should match with In operator', () => {
    const selector = {
      matchExpressions: [{ key: 'env', operator: 'In' as const, values: ['prod', 'staging'] }]
    }
    const labels = { env: 'prod' }

    expect(selectorMatchesLabels(selector, labels)).toBe(true)
  })

  it('should not match with In operator when value not in list', () => {
    const selector = {
      matchExpressions: [{ key: 'env', operator: 'In' as const, values: ['prod', 'staging'] }]
    }
    const labels = { env: 'dev' }

    expect(selectorMatchesLabels(selector, labels)).toBe(false)
  })

  it('should match with Exists operator', () => {
    const selector = {
      matchExpressions: [{ key: 'app', operator: 'Exists' as const }]
    }
    const labels = { app: 'nginx' }

    expect(selectorMatchesLabels(selector, labels)).toBe(true)
  })

  it('should not match with Exists operator when key missing', () => {
    const selector = {
      matchExpressions: [{ key: 'app', operator: 'Exists' as const }]
    }
    const labels = { tier: 'frontend' }

    expect(selectorMatchesLabels(selector, labels)).toBe(false)
  })

  it('should match with DoesNotExist operator', () => {
    const selector = {
      matchExpressions: [{ key: 'app', operator: 'DoesNotExist' as const }]
    }
    const labels = { tier: 'frontend' }

    expect(selectorMatchesLabels(selector, labels)).toBe(true)
  })
})

describe('getReplicaSetDesiredReplicas', () => {
  it('should return spec.replicas', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      replicas: 5,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      }
    })

    expect(getReplicaSetDesiredReplicas(rs)).toBe(5)
  })

  it('should return 1 if replicas not set', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      }
    })

    expect(getReplicaSetDesiredReplicas(rs)).toBe(1)
  })
})

describe('getReplicaSetReadyDisplay', () => {
  it('should return "ready/desired" format', () => {
    const rs = createReplicaSet({
      name: 'nginx-rs',
      namespace: 'default',
      replicas: 3,
      selector: { matchLabels: { app: 'nginx' } },
      template: {
        spec: { containers: [{ name: 'nginx', image: 'nginx' }] }
      }
    })

    // Initial status has 0 ready
    expect(getReplicaSetReadyDisplay(rs)).toBe('0/3')
  })
})
