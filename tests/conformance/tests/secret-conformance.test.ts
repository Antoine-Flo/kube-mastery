// ═══════════════════════════════════════════════════════════════════════════
// SECRET CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that Secret resources created by the simulator conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createSecret, encodeBase64, type Secret } from '../../../src/core/cluster/ressources/Secret'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator, removeSimulatorFields } from '../openapi/validator'

describe('Secret OpenAPI Conformance', () => {
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

    describe('valid secrets', () => {
        it('should validate minimal secret with Opaque type', () => {
            const secret = createSecret({
                name: 'test-secret',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: { password: encodeBase64('secret123') }
            })

            // Convert ADT type to string for OpenAPI validation and remove simulator fields
            const secretWithoutSimulator = removeSimulatorFields(secret) as Secret
            const secretForValidation = {
                ...secretWithoutSimulator,
                type: secret.type.type // Convert ADT to string
            }

            const result = validator.validateResource(secretForValidation, 'v1', 'Secret')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate secret with data (base64)', () => {
            const secret = createSecret({
                name: 'test-secret-full',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: {
                    username: encodeBase64('admin'),
                    password: encodeBase64('secret123')
                }
            })

            const secretWithoutSimulator = removeSimulatorFields(secret) as Secret
            const secretForValidation = {
                ...secretWithoutSimulator,
                type: secret.type.type // Convert ADT to string
            }

            const result = validator.validateResource(secretForValidation, 'v1', 'Secret')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate secret with service-account-token type', () => {
            const secret = createSecret({
                name: 'sa-token',
                namespace: 'kube-system',
                secretType: {
                    type: 'kubernetes.io/service-account-token',
                    serviceAccountName: 'default'
                },
                data: { token: encodeBase64('eyJhbG...') }
            })

            const secretWithoutSimulator = removeSimulatorFields(secret) as Secret
            const secretForValidation = {
                ...secretWithoutSimulator,
                type: secret.type.type // Convert ADT to string
            }

            const result = validator.validateResource(secretForValidation, 'v1', 'Secret')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate secret with dockerconfigjson type', () => {
            const dockerConfig = JSON.stringify({
                auths: {
                    'registry.example.com': {
                        auth: encodeBase64('user:pass')
                    }
                }
            })

            const secret = createSecret({
                name: 'docker-registry',
                namespace: 'default',
                secretType: {
                    type: 'kubernetes.io/dockerconfigjson',
                    dockerConfigJson: dockerConfig
                },
                data: {
                    '.dockerconfigjson': encodeBase64(dockerConfig)
                }
            })

            const secretWithoutSimulator = removeSimulatorFields(secret) as Secret
            const secretForValidation = {
                ...secretWithoutSimulator,
                type: secret.type.type // Convert ADT to string
            }

            const result = validator.validateResource(secretForValidation, 'v1', 'Secret')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate secret with labels and annotations', () => {
            const secret = createSecret({
                name: 'test-secret-labeled',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: { password: encodeBase64('secret') },
                labels: { app: 'test' },
                annotations: { description: 'Test secret' }
            })

            const secretWithoutSimulator = removeSimulatorFields(secret) as Secret
            const secretForValidation = {
                ...secretWithoutSimulator,
                type: secret.type.type // Convert ADT to string
            }

            const result = validator.validateResource(secretForValidation, 'v1', 'Secret')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })
    })

    describe('invalid secrets', () => {
        it('should reject secret with invalid data type', () => {
            const invalidSecret = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'test-secret',
                    namespace: 'default'
                },
                type: 'Opaque',
                data: 'invalid' // Invalid: should be Record<string, string>, not string
            }

            const result = validator.validateResource(invalidSecret, 'v1', 'Secret')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject secret with invalid type', () => {
            const invalidSecret = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'test-secret',
                    namespace: 'default'
                },
                type: 123, // Invalid: should be string
                data: { password: encodeBase64('secret') }
            }

            const result = validator.validateResource(invalidSecret, 'v1', 'Secret')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject secret with invalid namespace type', () => {
            const invalidSecret = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'test-secret',
                    namespace: 123 // Invalid: should be string
                },
                type: 'Opaque',
                data: { password: encodeBase64('secret') }
            }

            const result = validator.validateResource(invalidSecret, 'v1', 'Secret')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
            }
        })
    })
})

