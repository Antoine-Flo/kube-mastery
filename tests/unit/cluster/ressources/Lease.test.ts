import { describe, expect, it } from 'vitest'
import {
  createLease,
  parseLeaseManifest,
  type Lease,
  type OwnerReference
} from '../../../../src/core/cluster/ressources/Lease'

describe('Lease', () => {
  describe('createLease', () => {
    it('should create lease with minimal required fields', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          renewTime: new Date().toISOString()
        }
      })

      expect(lease.apiVersion).toBe('coordination.k8s.io/v1')
      expect(lease.kind).toBe('Lease')
      expect(lease.metadata.name).toBe('node-lease-1')
      expect(lease.metadata.namespace).toBe('kube-node-lease')
      expect(lease.spec.holderIdentity).toBe('node-1')
      expect(lease.spec.leaseDurationSeconds).toBe(40)
      expect(lease.spec.renewTime).toBeTruthy()
    })

    it('should include labels when provided', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        labels: {
          'kubernetes.io/node-name': 'node-1'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      expect(lease.metadata.labels).toEqual({
        'kubernetes.io/node-name': 'node-1'
      })
    })

    it('should include annotations when provided', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        annotations: {
          'lease.example.com/custom': 'value'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      expect(lease.metadata.annotations).toEqual({
        'lease.example.com/custom': 'value'
      })
    })

    it('should include owner references when provided', () => {
      const ownerRef: OwnerReference = {
        apiVersion: 'v1',
        kind: 'Node',
        name: 'node-1',
        uid: 'node-uid-123'
      }

      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        ownerReferences: [ownerRef],
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      expect(lease.metadata.ownerReferences).toEqual([ownerRef])
    })

    it('should include all spec fields when provided', () => {
      const acquireTime = new Date().toISOString()
      const renewTime = new Date().toISOString()

      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          acquireTime,
          renewTime,
          leaseTransitions: 5
        }
      })

      expect(lease.spec.holderIdentity).toBe('node-1')
      expect(lease.spec.leaseDurationSeconds).toBe(40)
      expect(lease.spec.acquireTime).toBe(acquireTime)
      expect(lease.spec.renewTime).toBe(renewTime)
      expect(lease.spec.leaseTransitions).toBe(5)
    })

    it('should use provided creationTimestamp', () => {
      const timestamp = '2024-01-01T00:00:00Z'
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        creationTimestamp: timestamp,
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      expect(lease.metadata.creationTimestamp).toBe(timestamp)
    })

    it('should generate creationTimestamp if not provided', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      expect(lease.metadata.creationTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should include resourceVersion and uid when provided', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        resourceVersion: '12345',
        uid: 'lease-uid-123',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      expect(lease.metadata.resourceVersion).toBe('12345')
      expect(lease.metadata.uid).toBe('lease-uid-123')
    })

    it('should create immutable lease object', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      // Verify the lease is actually frozen
      expect(Object.isFrozen(lease)).toBe(true)
    })
  })

  describe('parseLeaseManifest', () => {
    it('should parse valid lease manifest', () => {
      const manifest = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          name: 'node-lease-1',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          renewTime: '2024-01-01T00:00:00Z'
        }
      }

      const result = parseLeaseManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.apiVersion).toBe('coordination.k8s.io/v1')
        expect(result.value.kind).toBe('Lease')
        expect(result.value.metadata.name).toBe('node-lease-1')
        expect(result.value.spec.holderIdentity).toBe('node-1')
      }
    })

    it('should reject manifest with invalid apiVersion', () => {
      const manifest = {
        apiVersion: 'v1',
        kind: 'Lease',
        metadata: {
          name: 'node-lease-1',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      }

      const result = parseLeaseManifest(manifest)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('apiVersion')
      }
    })

    it('should reject manifest with invalid kind', () => {
      const manifest = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Pod',
        metadata: {
          name: 'node-lease-1',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      }

      const result = parseLeaseManifest(manifest)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('kind')
      }
    })

    it('should reject manifest missing required metadata', () => {
      const manifest = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      }

      const result = parseLeaseManifest(manifest)

      expect(result.ok).toBe(false)
    })

    it('should parse manifest with owner references', () => {
      const manifest = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          name: 'node-lease-1',
          namespace: 'kube-node-lease',
          ownerReferences: [
            {
              apiVersion: 'v1',
              kind: 'Node',
              name: 'node-1',
              uid: 'node-uid-123'
            }
          ]
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      }

      const result = parseLeaseManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.metadata.ownerReferences).toHaveLength(1)
        expect(result.value.metadata.ownerReferences?.[0].kind).toBe('Node')
        expect(result.value.metadata.ownerReferences?.[0].name).toBe('node-1')
      }
    })

    it('should parse manifest with optional spec fields', () => {
      const manifest = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          name: 'node-lease-1',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          acquireTime: '2024-01-01T00:00:00Z',
          renewTime: '2024-01-01T01:00:00Z',
          leaseTransitions: 3
        }
      }

      const result = parseLeaseManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.spec.acquireTime).toBe('2024-01-01T00:00:00Z')
        expect(result.value.spec.renewTime).toBe('2024-01-01T01:00:00Z')
        expect(result.value.spec.leaseTransitions).toBe(3)
      }
    })

    it('should reject manifest with invalid leaseDurationSeconds type', () => {
      const manifest = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          name: 'node-lease-1',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: '40'
        }
      }

      const result = parseLeaseManifest(manifest)

      expect(result.ok).toBe(false)
    })
  })
})
