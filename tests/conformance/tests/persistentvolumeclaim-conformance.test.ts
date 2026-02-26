// ═══════════════════════════════════════════════════════════════════════════
// PERSISTENTVOLUMECLAIM CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that PersistentVolumeClaim resources conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator } from '../openapi/validator'

describe('PersistentVolumeClaim OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    const specResult = await loadOpenAPISpec('api__v1_openapi.json')
    expect(specResult.ok).toBe(true)
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid persistentvolumeclaims', () => {
    it('should validate minimal persistent volume claim', () => {
      const persistentVolumeClaim = {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: 'pvc-minimal',
          namespace: 'default'
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: {
            requests: {
              storage: '1Gi'
            }
          }
        },
        status: {
          phase: 'Pending'
        }
      }

      const result = validator.validateResource(
        persistentVolumeClaim,
        'v1',
        'PersistentVolumeClaim'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate persistent volume claim created by factory', () => {
      const persistentVolumeClaim = createPersistentVolumeClaim({
        name: 'pvc-factory',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: {
            requests: {
              storage: '2Gi'
            }
          },
          storageClassName: 'fast'
        }
      })

      const result = validator.validateResource(
        persistentVolumeClaim,
        'v1',
        'PersistentVolumeClaim'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid persistentvolumeclaims', () => {
    it('should reject persistent volume claim with invalid metadata.namespace type', () => {
      const invalidPersistentVolumeClaim = {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: 'pvc-invalid',
          namespace: 123
        },
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: {
            requests: {
              storage: '1Gi'
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidPersistentVolumeClaim,
        'v1',
        'PersistentVolumeClaim'
      )
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject persistent volume claim with invalid accessModes type', () => {
      const invalidPersistentVolumeClaim = {
        apiVersion: 'v1',
        kind: 'PersistentVolumeClaim',
        metadata: {
          name: 'pvc-invalid',
          namespace: 'default'
        },
        spec: {
          accessModes: 'ReadWriteOnce',
          resources: {
            requests: {
              storage: '1Gi'
            }
          }
        }
      }

      const result = validator.validateResource(
        invalidPersistentVolumeClaim,
        'v1',
        'PersistentVolumeClaim'
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
