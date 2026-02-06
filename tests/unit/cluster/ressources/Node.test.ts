import { describe, expect, it } from 'vitest'
import {
    createNode,
    getNodeExternalIP,
    getNodeInternalIP,
    getNodeRoles,
    getNodeStatus,
    parseNodeManifest
} from '../../../../src/core/cluster/ressources/Node'

describe('Node', () => {
    describe('createNode', () => {
        it('should create node with minimal required fields', () => {
            const node = createNode({
                name: 'worker-node-1',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(node.apiVersion).toBe('v1')
            expect(node.kind).toBe('Node')
            expect(node.metadata.name).toBe('worker-node-1')
            expect(node.metadata.namespace).toBe('')
            expect(node.status.nodeInfo.kubeletVersion).toBe('v1.28.0')
        })

        it('should include labels when provided', () => {
            const node = createNode({
                name: 'control-plane',
                labels: {
                    'node-role.kubernetes.io/control-plane': '',
                    'kubernetes.io/os': 'linux'
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(node.metadata.labels).toEqual({
                'node-role.kubernetes.io/control-plane': '',
                'kubernetes.io/os': 'linux'
            })
        })

        it('should include annotations when provided', () => {
            const node = createNode({
                name: 'annotated-node',
                annotations: {
                    'node.alpha.kubernetes.io/ttl': '0'
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(node.metadata.annotations).toEqual({
                'node.alpha.kubernetes.io/ttl': '0'
            })
        })

        it('should use provided creationTimestamp', () => {
            const timestamp = '2024-01-15T10:30:00Z'
            const node = createNode({
                name: 'timed-node',
                creationTimestamp: timestamp,
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(node.metadata.creationTimestamp).toBe(timestamp)
        })

        it('should generate creationTimestamp if not provided', () => {
            const node = createNode({
                name: 'auto-timed-node',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(node.metadata.creationTimestamp).toBeTruthy()
            expect(node.metadata.creationTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        })

        it('should freeze the returned node object', () => {
            const node = createNode({
                name: 'frozen-node',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(Object.isFrozen(node)).toBe(true)
        })
    })

    describe('getNodeStatus', () => {
        it('should return Ready when condition Ready has status True', () => {
            const node = createNode({
                name: 'ready-node',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    },
                    conditions: [
                        {
                            type: 'Ready',
                            status: 'True',
                            lastTransitionTime: '2024-01-15T10:30:00Z'
                        }
                    ]
                }
            })

            expect(getNodeStatus(node)).toBe('Ready')
        })

        it('should return NotReady when condition Ready has status False', () => {
            const node = createNode({
                name: 'not-ready-node',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    },
                    conditions: [
                        {
                            type: 'Ready',
                            status: 'False',
                            reason: 'KubeletNotReady',
                            message: 'container runtime network not ready'
                        }
                    ]
                }
            })

            expect(getNodeStatus(node)).toBe('NotReady')
        })

        it('should return NotReady when Ready condition is missing', () => {
            const node = createNode({
                name: 'no-condition-node',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(getNodeStatus(node)).toBe('NotReady')
        })
    })

    describe('getNodeRoles', () => {
        it('should return control-plane for control-plane role', () => {
            const node = createNode({
                name: 'control-plane',
                labels: {
                    'node-role.kubernetes.io/control-plane': ''
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(getNodeRoles(node)).toBe('control-plane')
        })

        it('should return master for master role (deprecated)', () => {
            const node = createNode({
                name: 'master-node',
                labels: {
                    'node-role.kubernetes.io/master': ''
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(getNodeRoles(node)).toBe('master')
        })

        it('should return worker for worker role', () => {
            const node = createNode({
                name: 'worker-node',
                labels: {
                    'node-role.kubernetes.io/worker': ''
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(getNodeRoles(node)).toBe('worker')
        })

        it('should return <none> when no role labels are present', () => {
            const node = createNode({
                name: 'no-role-node',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            })

            expect(getNodeRoles(node)).toBe('<none>')
        })
    })

    describe('getNodeInternalIP', () => {
        it('should return InternalIP address when present', () => {
            const node = createNode({
                name: 'node-with-ip',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    },
                    addresses: [
                        {
                            type: 'InternalIP',
                            address: '192.168.1.10'
                        },
                        {
                            type: 'Hostname',
                            address: 'node-with-ip'
                        }
                    ]
                }
            })

            expect(getNodeInternalIP(node)).toBe('192.168.1.10')
        })

        it('should return <none> when InternalIP is missing', () => {
            const node = createNode({
                name: 'node-no-ip',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    },
                    addresses: [
                        {
                            type: 'Hostname',
                            address: 'node-no-ip'
                        }
                    ]
                }
            })

            expect(getNodeInternalIP(node)).toBe('<none>')
        })
    })

    describe('getNodeExternalIP', () => {
        it('should return ExternalIP address when present', () => {
            const node = createNode({
                name: 'node-with-external-ip',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    },
                    addresses: [
                        {
                            type: 'InternalIP',
                            address: '192.168.1.10'
                        },
                        {
                            type: 'ExternalIP',
                            address: '203.0.113.10'
                        }
                    ]
                }
            })

            expect(getNodeExternalIP(node)).toBe('203.0.113.10')
        })

        it('should return <none> when ExternalIP is missing', () => {
            const node = createNode({
                name: 'node-no-external-ip',
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    },
                    addresses: [
                        {
                            type: 'InternalIP',
                            address: '192.168.1.10'
                        }
                    ]
                }
            })

            expect(getNodeExternalIP(node)).toBe('<none>')
        })
    })

    describe('parseNodeManifest', () => {
        it('should parse valid node manifest', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {
                    name: 'test-node',
                    labels: {
                        'kubernetes.io/os': 'linux'
                    }
                },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    },
                    addresses: [
                        {
                            type: 'InternalIP',
                            address: '192.168.1.10'
                        }
                    ],
                    conditions: [
                        {
                            type: 'Ready',
                            status: 'True'
                        }
                    ]
                }
            }

            const result = parseNodeManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.name).toBe('test-node')
                expect(result.value.status.nodeInfo.kubeletVersion).toBe('v1.28.0')
                expect(result.value.status.addresses?.[0].address).toBe('192.168.1.10')
            }
        })

        it('should return error for missing name', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: {},
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            }

            const result = parseNodeManifest(manifest)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toContain('Invalid Node manifest')
            }
        })

        it('should return error for wrong apiVersion', () => {
            const manifest = {
                apiVersion: 'v2',
                kind: 'Node',
                metadata: { name: 'test' },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            }

            const result = parseNodeManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should return error for wrong kind', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Pod',
                metadata: { name: 'test' },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            }

            const result = parseNodeManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should freeze the parsed node', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Node',
                metadata: { name: 'frozen' },
                status: {
                    nodeInfo: {
                        architecture: 'amd64',
                        containerRuntimeVersion: 'containerd://1.6.0',
                        kernelVersion: '5.15.0',
                        kubeletVersion: 'v1.28.0',
                        operatingSystem: 'linux',
                        osImage: 'Ubuntu 22.04'
                    }
                }
            }

            const result = parseNodeManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(Object.isFrozen(result.value)).toBe(true)
            }
        })
    })
})
