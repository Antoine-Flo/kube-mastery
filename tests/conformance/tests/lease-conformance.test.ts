// ═══════════════════════════════════════════════════════════════════════════
// LEASE CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that Lease resources created by the simulator conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import {
  createLease,
  type Lease
} from '../../../src/core/cluster/ressources/Lease'
import { loadOpenAPISpec } from '../openapi/loader'
import {
  createOpenAPIValidator,
  removeSimulatorFields
} from '../openapi/validator'

describe('Lease OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    // Load OpenAPI spec
    const specResult = await loadOpenAPISpec(
      'apis__coordination.k8s.io__v1_openapi.json'
    )
    expect(specResult.ok).toBe(true)
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }

    // Create validator
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid leases', () => {
    it('should validate minimal lease with required fields', () => {
      const lease = createLease({
        name: 'test-lease',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'test-node',
          leaseDurationSeconds: 40,
          renewTime: new Date().toISOString()
        }
      })

      const leaseForValidation = removeSimulatorFields(lease) as Lease
      const result = validator.validateResource(
        leaseForValidation,
        'coordination.k8s.io/v1',
        'Lease'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate lease with owner references', () => {
      const lease = createLease({
        name: 'test-lease',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'test-node',
          leaseDurationSeconds: 40,
          renewTime: new Date().toISOString()
        },
        ownerReferences: [
          {
            apiVersion: 'v1',
            kind: 'Node',
            name: 'test-node',
            uid: 'test-uid-123'
          }
        ]
      })

      const leaseForValidation = removeSimulatorFields(lease) as Lease
      const result = validator.validateResource(
        leaseForValidation,
        'coordination.k8s.io/v1',
        'Lease'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate lease with labels and annotations', () => {
      const lease = createLease({
        name: 'test-lease',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'test-node',
          leaseDurationSeconds: 40,
          renewTime: new Date().toISOString()
        },
        labels: {
          'test-label': 'test-value'
        },
        annotations: {
          'test-annotation': 'test-annotation-value'
        }
      })

      const leaseForValidation = removeSimulatorFields(lease) as Lease
      const result = validator.validateResource(
        leaseForValidation,
        'coordination.k8s.io/v1',
        'Lease'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate lease with all spec fields', () => {
      const lease = createLease({
        name: 'test-lease',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'test-node',
          leaseDurationSeconds: 40,
          acquireTime: new Date().toISOString(),
          renewTime: new Date().toISOString(),
          leaseTransitions: 0
        }
      })

      const leaseForValidation = removeSimulatorFields(lease) as Lease
      const result = validator.validateResource(
        leaseForValidation,
        'coordination.k8s.io/v1',
        'Lease'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid leases', () => {
    it('should reject lease with invalid apiVersion', () => {
      const invalidLease = {
        apiVersion: 'invalid/v1', // Invalid API version
        kind: 'Lease',
        metadata: {
          name: 'test-lease',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'test-node',
          leaseDurationSeconds: 40
        }
      }

      // This should fail because the schema doesn't exist
      const result = validator.validateResource(
        invalidLease,
        'invalid/v1',
        'Lease'
      )
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Schema not found')
      }
    })

    it('should reject lease with invalid leaseDurationSeconds type', () => {
      const invalidLease = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          name: 'test-lease',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 'test-node',
          leaseDurationSeconds: 'invalid' // Invalid: should be number, not string
        }
      }

      const result = validator.validateResource(
        invalidLease,
        'coordination.k8s.io/v1',
        'Lease'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject lease with invalid holderIdentity type', () => {
      const invalidLease = {
        apiVersion: 'coordination.k8s.io/v1',
        kind: 'Lease',
        metadata: {
          name: 'test-lease',
          namespace: 'kube-node-lease'
        },
        spec: {
          holderIdentity: 123, // Invalid: should be string, not number
          leaseDurationSeconds: 40
        }
      }

      const result = validator.validateResource(
        invalidLease,
        'coordination.k8s.io/v1',
        'Lease'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })
  })
})
