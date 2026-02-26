// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENTVOLUME CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that PersistentVolume resources conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createPersistentVolume } from '../../../src/core/cluster/ressources/PersistentVolume'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator } from '../openapi/validator'

describe('PersistentVolume OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    const specResult = await loadOpenAPISpec('api__v1_openapi.json')
    expect(specResult.ok).toBe(true)
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid persistentvolumes', () => {
    it('should validate minimal persistent volume', () => {
      const persistentVolume = {
        apiVersion: 'v1',
        kind: 'PersistentVolume',
        metadata: {
          name: 'pv-minimal'
        },
        spec: {
          capacity: {
            storage: '10Gi'
          },
          accessModes: ['ReadWriteOnce'],
          hostPath: {
            path: '/tmp/pv-minimal'
          }
        },
        status: {
          phase: 'Available'
        }
      }

      const result = validator.validateResource(
        persistentVolume,
        'v1',
        'PersistentVolume'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate persistent volume created by factory', () => {
      const persistentVolume = createPersistentVolume({
        name: 'pv-factory',
        spec: {
          capacity: {
            storage: '20Gi'
          },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'fast',
          persistentVolumeReclaimPolicy: 'Retain',
          hostPath: {
            path: '/tmp/pv-factory',
            type: 'DirectoryOrCreate'
          }
        }
      })

      const result = validator.validateResource(
        persistentVolume,
        'v1',
        'PersistentVolume'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid persistentvolumes', () => {
    it('should reject persistent volume with invalid metadata.name type', () => {
      const invalidPersistentVolume = {
        apiVersion: 'v1',
        kind: 'PersistentVolume',
        metadata: {
          name: 123
        },
        spec: {
          capacity: {
            storage: '5Gi'
          },
          accessModes: ['ReadWriteOnce'],
          hostPath: {
            path: '/tmp/pv-invalid'
          }
        }
      }

      const result = validator.validateResource(
        invalidPersistentVolume,
        'v1',
        'PersistentVolume'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject persistent volume with invalid accessModes type', () => {
      const invalidPersistentVolume = {
        apiVersion: 'v1',
        kind: 'PersistentVolume',
        metadata: {
          name: 'pv-invalid'
        },
        spec: {
          capacity: {
            storage: '5Gi'
          },
          accessModes: 'ReadWriteOnce',
          hostPath: {
            path: '/tmp/pv-invalid'
          }
        }
      }

      const result = validator.validateResource(
        invalidPersistentVolume,
        'v1',
        'PersistentVolume'
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
