// ═══════════════════════════════════════════════════════════════════════════
// REPLICASET CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that ReplicaSet resources conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createReplicaSet } from '../../../src/core/cluster/ressources/ReplicaSet'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator } from '../openapi/validator'

describe('ReplicaSet OpenAPI Conformance', () => {
    let validator: ReturnType<typeof createOpenAPIValidator>

    beforeAll(async () => {
        // Load OpenAPI spec for apps/v1
        const specResult = await loadOpenAPISpec('apis__apps__v1_openapi.json')
        expect(specResult.ok).toBe(true)
        if (!specResult.ok) {
            throw new Error(`Failed to load spec: ${specResult.error}`)
        }

        // Create validator
        validator = createOpenAPIValidator(specResult.value)
    })

    describe('valid replicasets', () => {
        it('should validate minimal ReplicaSet', () => {
            const replicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'test-rs',
                    namespace: 'default',
                    creationTimestamp: new Date().toISOString()
                },
                spec: {
                    replicas: 1,
                    selector: {
                        matchLabels: {
                            app: 'test'
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: 'test'
                            }
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
                }
            }

            const result = validator.validateResource(replicaSet, 'apps/v1', 'ReplicaSet')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate ReplicaSet with multiple replicas', () => {
            const replicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'test-rs',
                    namespace: 'default',
                    creationTimestamp: new Date().toISOString()
                },
                spec: {
                    replicas: 5,
                    selector: {
                        matchLabels: {
                            app: 'test'
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: 'test'
                            }
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
                }
            }

            const result = validator.validateResource(replicaSet, 'apps/v1', 'ReplicaSet')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate ReplicaSet with labels and annotations', () => {
            const replicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'test-rs',
                    namespace: 'default',
                    creationTimestamp: new Date().toISOString(),
                    labels: {
                        app: 'test',
                        version: '1.0'
                    },
                    annotations: {
                        description: 'Test replicaset'
                    }
                },
                spec: {
                    replicas: 3,
                    selector: {
                        matchLabels: {
                            app: 'test'
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: 'test'
                            }
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
                }
            }

            const result = validator.validateResource(replicaSet, 'apps/v1', 'ReplicaSet')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate ReplicaSet with ownerReferences', () => {
            const replicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'nginx-deployment-abc123',
                    namespace: 'default',
                    creationTimestamp: new Date().toISOString(),
                    ownerReferences: [
                        {
                            apiVersion: 'apps/v1',
                            kind: 'Deployment',
                            name: 'nginx-deployment',
                            uid: 'deployment-uid-123',
                            controller: true
                        }
                    ]
                },
                spec: {
                    replicas: 3,
                    selector: {
                        matchLabels: {
                            app: 'nginx'
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: 'nginx'
                            }
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
                }
            }

            const result = validator.validateResource(replicaSet, 'apps/v1', 'ReplicaSet')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate ReplicaSet with matchExpressions selector', () => {
            const replicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'test-rs',
                    namespace: 'default',
                    creationTimestamp: new Date().toISOString()
                },
                spec: {
                    replicas: 2,
                    selector: {
                        matchLabels: {
                            app: 'test'
                        },
                        matchExpressions: [
                            {
                                key: 'env',
                                operator: 'In',
                                values: ['production', 'staging']
                            }
                        ]
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: 'test',
                                env: 'production'
                            }
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
                }
            }

            const result = validator.validateResource(replicaSet, 'apps/v1', 'ReplicaSet')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate ReplicaSet created by createReplicaSet factory', () => {
            const rs = createReplicaSet({
                name: 'factory-rs',
                namespace: 'default',
                replicas: 3,
                selector: { matchLabels: { app: 'nginx' } },
                template: {
                    metadata: { labels: { app: 'nginx' } },
                    spec: {
                        containers: [{ name: 'nginx', image: 'nginx:latest' }],
                    },
                },
                labels: { app: 'nginx' },
            })

            const result = validator.validateResource(rs, 'apps/v1', 'ReplicaSet')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })
    })

    describe('invalid replicasets', () => {
        it('should reject ReplicaSet without spec.selector', () => {
            const invalidReplicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'test-rs',
                    namespace: 'default'
                },
                spec: {
                    replicas: 1,
                    template: {
                        metadata: {
                            labels: {
                                app: 'test'
                            }
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
                }
            }

            const result = validator.validateResource(invalidReplicaSet, 'apps/v1', 'ReplicaSet')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        // Note: OpenAPI spec doesn't require template at schema level,
        // but Kubernetes API server will reject it at runtime.
        // We validate runtime-required fields in our Zod schemas instead.

        it('should reject ReplicaSet with invalid replicas type', () => {
            const invalidReplicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'test-rs',
                    namespace: 'default'
                },
                spec: {
                    replicas: 'invalid', // Invalid: should be number
                    selector: {
                        matchLabels: {
                            app: 'test'
                        }
                    },
                    template: {
                        metadata: {
                            labels: {
                                app: 'test'
                            }
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
                }
            }

            const result = validator.validateResource(invalidReplicaSet, 'apps/v1', 'ReplicaSet')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject ReplicaSet with invalid selector type', () => {
            const invalidReplicaSet = {
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                metadata: {
                    name: 'test-rs',
                    namespace: 'default'
                },
                spec: {
                    replicas: 1,
                    selector: 'invalid', // Invalid: should be object with matchLabels
                    template: {
                        metadata: {
                            labels: {
                                app: 'test'
                            }
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
                }
            }

            const result = validator.validateResource(invalidReplicaSet, 'apps/v1', 'ReplicaSet')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })
    })
})
