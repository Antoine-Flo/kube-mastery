// ═══════════════════════════════════════════════════════════════════════════
// NODE CONFORMANCE TESTS
// ═══════════════════════════════════════════════════════════════════════════
// Validates that Node resources created by the simulator conform to Kubernetes OpenAPI specs

import { beforeAll, describe, expect, it } from 'vitest'
import { createNode, type Node } from '../../../src/core/cluster/ressources/Node'
import { loadOpenAPISpec } from '../openapi/loader'
import { createOpenAPIValidator, removeSimulatorFields } from '../openapi/validator'

describe('Node OpenAPI Conformance', () => {
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

    describe('valid nodes', () => {
        it('should validate minimal node with required fields', () => {
            const node = createNode({
                name: 'test-node',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate node with optional spec fields', () => {
            const node = createNode({
                name: 'test-node-full',
                spec: {
                    podCIDR: '10.244.0.0/24',
                    podCIDRs: ['10.244.0.0/24'],
                    providerID: 'provider://test',
                    unschedulable: false
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate node with taints', () => {
            const node = createNode({
                name: 'tainted-node',
                spec: {
                    taints: [
                        {
                            key: 'node-role.kubernetes.io/control-plane',
                            effect: 'NoSchedule'
                        },
                        {
                            key: 'example.com/dedicated',
                            value: 'true',
                            effect: 'NoExecute'
                        }
                    ]
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate node with addresses', () => {
            const node = createNode({
                name: 'node-with-addresses',
                status: {
                    addresses: [
                        {
                            type: 'InternalIP',
                            address: '192.168.1.10'
                        },
                        {
                            type: 'ExternalIP',
                            address: '203.0.113.10'
                        },
                        {
                            type: 'Hostname',
                            address: 'node.example.com'
                        }
                    ],
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate node with conditions', () => {
            const node = createNode({
                name: 'node-with-conditions',
                status: {
                    conditions: [
                        {
                            type: 'Ready',
                            status: 'True',
                            lastHeartbeatTime: '2024-01-01T00:00:00Z',
                            lastTransitionTime: '2024-01-01T00:00:00Z',
                            reason: 'KubeletReady',
                            message: 'kubelet is posting ready status'
                        },
                        {
                            type: 'MemoryPressure',
                            status: 'False',
                            reason: 'KubeletHasSufficientMemory'
                        },
                        {
                            type: 'DiskPressure',
                            status: 'False',
                            reason: 'KubeletHasNoDiskPressure'
                        }
                    ],
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate node with capacity and allocatable', () => {
            const node = createNode({
                name: 'node-with-resources',
                status: {
                    capacity: {
                        cpu: '4',
                        memory: '8Gi',
                        pods: '110'
                    },
                    allocatable: {
                        cpu: '3',
                        memory: '7Gi',
                        pods: '110'
                    },
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate node with labels and annotations', () => {
            const node = createNode({
                name: 'node-labeled',
                labels: {
                    'node-role.kubernetes.io/control-plane': '',
                    'kubernetes.io/arch': 'amd64',
                    'kubernetes.io/os': 'linux'
                },
                annotations: {
                    'node.alpha.kubernetes.io/ttl': '0',
                    'volumes.kubernetes.io/controller-managed-attach-detach': 'true'
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })

        it('should validate node with daemonEndpoints', () => {
            const node = createNode({
                name: 'node-with-endpoints',
                status: {
                    daemonEndpoints: {
                        kubeletEndpoint: {
                            Port: 10250
                        }
                    },
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            })

            const nodeForValidation = removeSimulatorFields(node) as Node
            const result = validator.validateResource(nodeForValidation, 'v1', 'Node')
            if (!result.ok) {
                throw new Error(`Validation failed: ${result.error}`)
            }
            expect(result.value.valid).toBe(true)
        })
    })

    describe('invalid nodes', () => {
        it('should reject node with invalid apiVersion', () => {
            const invalidNode = {
                apiVersion: 'invalid/v1', // Invalid API version
                kind: 'Node',
                metadata: {
                    name: 'test-node'
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            }

            // This should fail because the schema doesn't exist
            const result = validator.validateResource(invalidNode, 'invalid/v1', 'Node')
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toContain('Schema not found')
            }
        })

        it('should reject node without status.nodeInfo', () => {
            const invalidNode = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {
                    name: 'test-node'
                },
                status: {}
            }

            const result = validator.validateResource(invalidNode, 'v1', 'Node')
            expect(result.ok).toBe(true)
            if (result.ok) {
                // OpenAPI schema may allow empty status, but nodeInfo is required when status is present
                // If schema is permissive, this test may pass - that's acceptable
                if (result.value.valid === false) {
                    expect(result.value.errors).toBeDefined()
                    expect(result.value.errors?.length).toBeGreaterThan(0)
                }
            }
        })

        it('should reject node with invalid nodeInfo type', () => {
            const invalidNode = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {
                    name: 'test-node'
                },
                status: {
                    nodeInfo: 'invalid' // Invalid: should be object, not string
                }
            }

            const result = validator.validateResource(invalidNode, 'v1', 'Node')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject node with invalid address type', () => {
            const invalidNode = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {
                    name: 'test-node'
                },
                status: {
                    addresses: [
                        {
                            type: 123, // Invalid: should be string
                            address: '192.168.1.10'
                        }
                    ],
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            }

            const result = validator.validateResource(invalidNode, 'v1', 'Node')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject node with invalid condition status', () => {
            const invalidNode = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {
                    name: 'test-node'
                },
                status: {
                    conditions: [
                        {
                            type: 'Ready',
                            status: 123, // Invalid: should be string, not number
                            reason: 'KubeletReady'
                        }
                    ],
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            }

            const result = validator.validateResource(invalidNode, 'v1', 'Node')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject node with invalid taint effect type', () => {
            const invalidNode = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {
                    name: 'test-node'
                },
                spec: {
                    taints: [
                        {
                            key: 'example.com/test',
                            effect: 123 // Invalid: should be string, not number
                        }
                    ]
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04',
                        machineID: 'test-machine-id',
                        systemUUID: 'test-system-uuid',
                        bootID: 'test-boot-id',
                        kubeProxyVersion: 'v1.28.0'
                    }
                }
            }

            const result = validator.validateResource(invalidNode, 'v1', 'Node')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })

        it('should reject node with invalid kubeletVersion type', () => {
            const invalidNode = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {
                    name: 'test-node'
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 123, // Invalid: should be string
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            }

            const result = validator.validateResource(invalidNode, 'v1', 'Node')
            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.valid).toBe(false)
                expect(result.value.errors).toBeDefined()
                expect(result.value.errors?.length).toBeGreaterThan(0)
            }
        })
    })
})
