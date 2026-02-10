// ═══════════════════════════════════════════════════════════════════════════
// CONFIGMAP CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that ConfigMap resources created by the simulator conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createConfigMap, type ConfigMap } from '../../../src/core/cluster/ressources/ConfigMap'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator, removeSimulatorFields } from '../openapi/validator'

describe('ConfigMap OpenAPI Conformance', () => {
  let validator: ReturnType<typeof createOpenAPIValidator>

  beforeAll(async () => {
    // Load OpenAPI spec
    const specResult = await loadOpenAPISpec('api__v1_openapi.json')
    expect(specResult.ok).toBe(true)
    if (!specResult.ok) {
      throw new Error(`Failed to load spec: ${specResult.error}`)
    }

    // Create validator
    validator = createOpenAPIValidator(specResult.value)
  })

  describe('valid configmaps', () => {
    it('should validate minimal configmap', () => {
      const configMap = createConfigMap({
        name: 'test-config',
        namespace: 'default',
        data: { key: 'value' }
      })

      const cmForValidation = removeSimulatorFields(configMap) as ConfigMap
      const result = validator.validateResource(cmForValidation, 'v1', 'ConfigMap')
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate configmap with data and binaryData', () => {
      const configMap = createConfigMap({
        name: 'test-config-full',
        namespace: 'default',
        data: { key: 'value', another: 'data' },
        binaryData: { binary: 'YmFzZTY0' } // base64 encoded
      })

      const cmForValidation = removeSimulatorFields(configMap) as ConfigMap
      const result = validator.validateResource(cmForValidation, 'v1', 'ConfigMap')
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate configmap with labels and annotations', () => {
      const configMap = createConfigMap({
        name: 'test-config-labeled',
        namespace: 'default',
        data: { key: 'value' },
        labels: { app: 'test' },
        annotations: { description: 'Test configmap' }
      })

      const cmForValidation = removeSimulatorFields(configMap) as ConfigMap
      const result = validator.validateResource(cmForValidation, 'v1', 'ConfigMap')
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })

  describe('invalid configmaps', () => {
    it('should reject configmap with invalid data type', () => {
      const invalidCm = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'test-config',
          namespace: 'default'
        },
        data: 'invalid' // Invalid: should be Record<string, string>, not string
      }

      const result = validator.validateResource(invalidCm, 'v1', 'ConfigMap')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should reject configmap with invalid binaryData type', () => {
      const invalidCm = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: 'test-config',
          namespace: 'default'
        },
        binaryData: 'invalid' // Invalid: should be Record<string, string>, not string
      }

      const result = validator.validateResource(invalidCm, 'v1', 'ConfigMap')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.valid).toBe(false)
        expect(result.value.errors).toBeDefined()
        expect(result.value.errors?.length).toBeGreaterThan(0)
      }
    })

    it('should validate configmap with empty data', () => {
      const configMap = createConfigMap({
        name: 'test-config-empty',
        namespace: 'default',
        data: {}
      })

      const cmForValidation = removeSimulatorFields(configMap) as ConfigMap
      const result = validator.validateResource(cmForValidation, 'v1', 'ConfigMap')
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })

    it('should validate configmap without data or binaryData', () => {
      const configMap = createConfigMap({
        name: 'test-config-no-data',
        namespace: 'default'
      })

      const cmForValidation = removeSimulatorFields(configMap) as ConfigMap
      const result = validator.validateResource(cmForValidation, 'v1', 'ConfigMap')
      if (!result.ok) {
        throw new Error(`Validation failed: ${result.error}`)
      }
      expect(result.value.valid).toBe(true)
    })
  })
})
