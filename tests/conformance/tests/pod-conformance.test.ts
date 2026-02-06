// ═══════════════════════════════════════════════════════════════════════════
// POD CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that Pod resources created by the simulator conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createPod, type Pod } from '../../../src/core/cluster/ressources/Pod'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator, removeSimulatorFields } from '../openapi/validator'

describe('Pod OpenAPI Conformance', () => {
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

    describe('valid pods', () => {
        it('should validate minimal pod with required fields', () => {
            const pod = createPod({
                name: 'test-pod',
                namespace: 'default',
                containers: [
                    {
                        name: 'nginx',
                        image: 'nginx:latest'
                    }
                ]
            })

            const podWithoutSimulator = removeSimulatorFields(pod) as Pod
            const podForValidation = {
                ...podWithoutSimulator,
                status: {
                    phase: podWithoutSimulator.status.phase
                }
            }
            const result = validator.validateResource(podForValidation, 'v1', 'Pod')
            if (!result.ok) {
                console.error('Validation error:', result.error)
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate pod with optional fields', () => {
            const pod = createPod({
                name: 'test-pod-full',
                namespace: 'default',
                containers: [
                    {
                        name: 'nginx',
                        image: 'nginx:latest',
                        ports: [{ containerPort: 80 }]
                    }
                ],
                labels: { app: 'test' },
                annotations: { description: 'Test pod' }
            })

            const podWithoutSimulator = removeSimulatorFields(pod) as Pod
            const podForValidation = {
                ...podWithoutSimulator,
                status: {
                    phase: podWithoutSimulator.status.phase
                }
            }
            const result = validator.validateResource(podForValidation, 'v1', 'Pod')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(true)
            }
        })

        it('should validate pod with initContainers', () => {
            const pod = createPod({
                name: 'test-pod-init',
                namespace: 'default',
                initContainers: [
                    {
                        name: 'init',
                        image: 'busybox:latest'
                    }
                ],
                containers: [
                    {
                        name: 'nginx',
                        image: 'nginx:latest'
                    }
                ]
            })

            const podWithoutSimulator = removeSimulatorFields(pod) as Pod
            const podForValidation = {
                ...podWithoutSimulator,
                status: {
                    phase: podWithoutSimulator.status.phase
                }
            }
            const result = validator.validateResource(podForValidation, 'v1', 'Pod')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate pod with resources (requests and limits)', () => {
            const pod = createPod({
                name: 'test-pod-resources',
                namespace: 'default',
                containers: [
                    {
                        name: 'nginx',
                        image: 'nginx:latest',
                        resources: {
                            requests: {
                                cpu: '100m',
                                memory: '128Mi'
                            },
                            limits: {
                                cpu: '500m',
                                memory: '512Mi'
                            }
                        }
                    }
                ]
            })

            const podWithoutSimulator = removeSimulatorFields(pod) as Pod
            const podForValidation = {
                ...podWithoutSimulator,
                status: {
                    phase: podWithoutSimulator.status.phase
                }
            }
            const result = validator.validateResource(podForValidation, 'v1', 'Pod')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate pod with env vars', () => {
            const pod = createPod({
                name: 'test-pod-env',
                namespace: 'default',
                containers: [
                    {
                        name: 'nginx',
                        image: 'nginx:latest',
                        env: [
                            {
                                name: 'ENV_VAR',
                                source: { type: 'value', value: 'test-value' }
                            }
                        ]
                    }
                ]
            })

            // Convert env ADT to OpenAPI format and remove simulator fields
            const podWithoutSimulator = removeSimulatorFields(pod) as Pod
            const podForValidation = {
                ...podWithoutSimulator,
                spec: {
                    ...podWithoutSimulator.spec,
                    containers: podWithoutSimulator.spec.containers.map(c => ({
                        name: c.name,
                        image: c.image,
                        env: c.env?.map(e => ({
                            name: e.name,
                            value: e.source.type === 'value' ? e.source.value : undefined
                        }))
                    }))
                },
                status: {
                    phase: podWithoutSimulator.status.phase
                }
            }

            const result = validator.validateResource(podForValidation, 'v1', 'Pod')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate pod with probes', () => {
            const pod = createPod({
                name: 'test-pod-probes',
                namespace: 'default',
                containers: [
                    {
                        name: 'nginx',
                        image: 'nginx:latest',
                        livenessProbe: {
                            type: 'httpGet',
                            path: '/health',
                            port: 80,
                            initialDelaySeconds: 30,
                            periodSeconds: 10
                        },
                        readinessProbe: {
                            type: 'httpGet',
                            path: '/ready',
                            port: 80
                        }
                    }
                ]
            })

            // Convert probes ADT to OpenAPI format and remove simulator fields
            const podWithoutSimulator = removeSimulatorFields(pod) as Pod
            const podForValidation = {
                ...podWithoutSimulator,
                spec: {
                    ...podWithoutSimulator.spec,
                    containers: podWithoutSimulator.spec.containers.map(c => {
                        const container: any = {
                            name: c.name,
                            image: c.image
                        }
                        if (c.livenessProbe?.type === 'httpGet') {
                            container.livenessProbe = {
                                httpGet: {
                                    path: c.livenessProbe.path,
                                    port: c.livenessProbe.port
                                },
                                initialDelaySeconds: c.livenessProbe.initialDelaySeconds,
                                periodSeconds: c.livenessProbe.periodSeconds
                            }
                        }
                        if (c.readinessProbe?.type === 'httpGet') {
                            container.readinessProbe = {
                                httpGet: {
                                    path: c.readinessProbe.path,
                                    port: c.readinessProbe.port
                                }
                            }
                        }
                        return container
                    })
                },
                status: {
                    phase: podWithoutSimulator.status.phase
                }
            }

            const result = validator.validateResource(podForValidation, 'v1', 'Pod')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })
    })

    describe('invalid pods', () => {
        it('should reject pod with invalid apiVersion', () => {
            const invalidPod = {
                apiVersion: 'invalid/v1', // Invalid API version
                kind: 'Pod',
                metadata: {
                    name: 'test-pod',
                    namespace: 'default'
                },
                spec: {
                    containers: [
                        {
                            name: 'nginx',
                            image: 'nginx:latest'
                        }
                    ]
                }
            }

            // This should fail because the schema doesn't exist
            const result = validator.validateResource(invalidPod, 'invalid/v1', 'Pod')
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toContain('Schema not found')
            }
        })

        it('should reject pod without spec.containers', () => {
            const invalidPod = {
                apiVersion: 'v1',
                kind: 'Pod',
                metadata: {
                    name: 'test-pod',
                    namespace: 'default'
                },
                spec: {}
            }

            const result = validator.validateResource(invalidPod, 'v1', 'Pod')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
            }
        })

        it('should reject pod with invalid container name type', () => {
            const invalidPod = {
                apiVersion: 'v1',
                kind: 'Pod',
                metadata: {
                    name: 'test-pod',
                    namespace: 'default'
                },
                spec: {
                    containers: [
                        {
                            name: 123, // Invalid: should be string
                            image: 'nginx:latest'
                        }
                    ]
                }
            }

            const result = validator.validateResource(invalidPod, 'v1', 'Pod')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject pod with invalid container image type', () => {
            const invalidPod = {
                apiVersion: 'v1',
                kind: 'Pod',
                metadata: {
                    name: 'test-pod',
                    namespace: 'default'
                },
                spec: {
                    containers: [
                        {
                            name: 'nginx',
                            image: 123 // Invalid: should be string
                        }
                    ]
                }
            }

            const result = validator.validateResource(invalidPod, 'v1', 'Pod')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
            }
        })

        it('should reject pod with invalid port type', () => {
            const invalidPod = {
                apiVersion: 'v1',
                kind: 'Pod',
                metadata: {
                    name: 'test-pod',
                    namespace: 'default'
                },
                spec: {
                    containers: [
                        {
                            name: 'nginx',
                            image: 'nginx:latest',
                            ports: [
                                {
                                    containerPort: 'invalid' // Invalid: should be number
                                }
                            ]
                        }
                    ]
                }
            }

            const result = validator.validateResource(invalidPod, 'v1', 'Pod')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject pod with invalid namespace type', () => {
            const invalidPod = {
                apiVersion: 'v1',
                kind: 'Pod',
                metadata: {
                    name: 'test-pod',
                    namespace: 123 // Invalid: should be string
                },
                spec: {
                    containers: [
                        {
                            name: 'nginx',
                            image: 'nginx:latest'
                        }
                    ]
                }
            }

            const result = validator.validateResource(invalidPod, 'v1', 'Pod')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })
    })
})

