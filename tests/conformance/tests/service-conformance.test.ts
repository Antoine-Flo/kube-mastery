// ═══════════════════════════════════════════════════════════════════════════
// SERVICE CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that Service resources created by the simulator conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import {
  createService,
  type Service
} from '../../../src/core/cluster/ressources/Service'
import { loadOpenAPISpec } from '../openapi/loader'
import {
  createOpenAPIValidator,
  removeSimulatorFields
} from '../openapi/validator'

describe('Service OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    const specResult = await loadOpenAPISpec('api__v1_openapi.json')
    expect(specResult.ok).toBe(true)
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid services', () => {
    it('should validate minimal ClusterIP service', () => {
      const service = createService({
        name: 'web-service',
        namespace: 'default',
        selector: { app: 'web' },
        ports: [{ port: 80, targetPort: 8080 }]
      })

      const serviceForValidation = removeSimulatorFields(service) as Service
      const result = validator.validateResource(
        serviceForValidation,
        'v1',
        'Service'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate NodePort service', () => {
      const service = createService({
        name: 'nodeport-service',
        namespace: 'default',
        type: 'NodePort',
        selector: { app: 'web' },
        ports: [{ port: 80, targetPort: 8080, nodePort: 30080 }]
      })

      const serviceForValidation = removeSimulatorFields(service) as Service
      const result = validator.validateResource(
        serviceForValidation,
        'v1',
        'Service'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate ExternalName service', () => {
      const service = createService({
        name: 'external-service',
        namespace: 'default',
        type: 'ExternalName',
        externalName: 'api.example.com',
        ports: [{ port: 443, protocol: 'TCP' }]
      })

      const serviceForValidation = removeSimulatorFields(service) as Service
      const result = validator.validateResource(
        serviceForValidation,
        'v1',
        'Service'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate service with labels, annotations and status', () => {
      const service = createService({
        name: 'lb-service',
        namespace: 'default',
        type: 'LoadBalancer',
        selector: { app: 'web' },
        ports: [{ name: 'http', port: 80, targetPort: 8080 }],
        labels: { app: 'web', tier: 'frontend' },
        annotations: { description: 'Public service' },
        status: {
          loadBalancer: {
            ingress: [{ ip: '34.120.10.20' }]
          }
        }
      })

      const serviceForValidation = removeSimulatorFields(service) as Service
      const result = validator.validateResource(
        serviceForValidation,
        'v1',
        'Service'
      )
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid services', () => {
    it('should reject service with invalid spec.ports type', () => {
      const invalidService = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'invalid-service',
          namespace: 'default'
        },
        spec: {
          type: 'ClusterIP',
          selector: { app: 'web' },
          ports: 'invalid'
        }
      }

      const result = validator.validateResource(invalidService, 'v1', 'Service')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject service with invalid spec.type', () => {
      const invalidService = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'invalid-service',
          namespace: 'default'
        },
        spec: {
          type: 123,
          ports: [{ port: 80 }]
        }
      }

      const result = validator.validateResource(invalidService, 'v1', 'Service')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject service with invalid port type', () => {
      const invalidService = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'invalid-service',
          namespace: 'default'
        },
        spec: {
          type: 'ClusterIP',
          ports: [{ port: 'eighty' }]
        }
      }

      const result = validator.validateResource(invalidService, 'v1', 'Service')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject service with invalid metadata.namespace type', () => {
      const invalidService = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'invalid-service',
          namespace: 123
        },
        spec: {
          ports: [{ port: 80 }]
        }
      }

      const result = validator.validateResource(invalidService, 'v1', 'Service')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
      }
    })
  })
})
