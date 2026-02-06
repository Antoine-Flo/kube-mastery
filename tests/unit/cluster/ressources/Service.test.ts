import { describe, expect, it } from 'vitest'
import { createService, parseServiceManifest, getServiceType } from '../../../../src/core/cluster/ressources/Service'

describe('Service', () => {
    describe('createService', () => {
        it('should create service with minimal config (ClusterIP)', () => {
            const service = createService({
                name: 'my-service',
                namespace: 'default',
                ports: [{ port: 80, protocol: 'TCP' }]
            })

            expect(service.apiVersion).toBe('v1')
            expect(service.kind).toBe('Service')
            expect(service.metadata.name).toBe('my-service')
            expect(service.metadata.namespace).toBe('default')
            expect(service.spec.type).toBe('ClusterIP')
            expect(service.spec.ports).toHaveLength(1)
            expect(service.spec.ports[0].port).toBe(80)
            expect(service.spec.ports[0].protocol).toBe('TCP')
        })

        it('should default type to ClusterIP if not specified', () => {
            const service = createService({
                name: 'default-service',
                namespace: 'default',
                ports: [{ port: 443 }]
            })

            expect(service.spec.type).toBe('ClusterIP')
        })

        it('should default protocol to TCP if not specified', () => {
            const service = createService({
                name: 'tcp-service',
                namespace: 'default',
                ports: [{ port: 80 }]
            })

            expect(service.spec.ports[0].protocol).toBe('TCP')
        })

        it('should create service with selector', () => {
            const service = createService({
                name: 'selector-service',
                namespace: 'default',
                ports: [{ port: 80 }],
                selector: { app: 'myapp', tier: 'frontend' }
            })

            expect(service.spec.selector).toEqual({ app: 'myapp', tier: 'frontend' })
        })

        it('should create service with targetPort', () => {
            const service = createService({
                name: 'targetport-service',
                namespace: 'default',
                ports: [{ port: 80, targetPort: 8080 }]
            })

            expect(service.spec.ports[0].targetPort).toBe(8080)
        })

        it('should create service with named port', () => {
            const service = createService({
                name: 'named-port-service',
                namespace: 'default',
                ports: [{ name: 'http', port: 80, protocol: 'TCP' }]
            })

            expect(service.spec.ports[0].name).toBe('http')
        })

        it('should create service with multiple ports', () => {
            const service = createService({
                name: 'multi-port-service',
                namespace: 'default',
                ports: [
                    { name: 'http', port: 80 },
                    { name: 'https', port: 443 }
                ]
            })

            expect(service.spec.ports).toHaveLength(2)
            expect(service.spec.ports[0].port).toBe(80)
            expect(service.spec.ports[1].port).toBe(443)
        })

        it('should create service with clusterIP', () => {
            const service = createService({
                name: 'clusterip-service',
                namespace: 'default',
                ports: [{ port: 80 }],
                clusterIP: '10.96.0.1'
            })

            expect(service.spec.clusterIP).toBe('10.96.0.1')
        })

        it('should create headless service with clusterIP None', () => {
            const service = createService({
                name: 'headless-service',
                namespace: 'default',
                ports: [{ port: 80 }],
                clusterIP: 'None'
            })

            expect(service.spec.clusterIP).toBe('None')
        })

        it('should include labels when provided', () => {
            const service = createService({
                name: 'labeled-service',
                namespace: 'default',
                ports: [{ port: 80 }],
                labels: { app: 'myapp', env: 'prod' }
            })

            expect(service.metadata.labels).toEqual({ app: 'myapp', env: 'prod' })
        })

        it('should include annotations when provided', () => {
            const service = createService({
                name: 'annotated-service',
                namespace: 'default',
                ports: [{ port: 80 }],
                annotations: { 'kubernetes.io/description': 'My service' }
            })

            expect(service.metadata.annotations).toEqual({
                'kubernetes.io/description': 'My service'
            })
        })

        it('should use provided creationTimestamp', () => {
            const timestamp = '2024-01-15T10:30:00Z'
            const service = createService({
                name: 'timed-service',
                namespace: 'default',
                ports: [{ port: 80 }],
                creationTimestamp: timestamp
            })

            expect(service.metadata.creationTimestamp).toBe(timestamp)
        })

        it('should generate creationTimestamp if not provided', () => {
            const service = createService({
                name: 'auto-timed-service',
                namespace: 'default',
                ports: [{ port: 80 }]
            })

            expect(service.metadata.creationTimestamp).toBeTruthy()
            expect(service.metadata.creationTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        })

        it('should freeze the returned service object', () => {
            const service = createService({
                name: 'frozen-service',
                namespace: 'default',
                ports: [{ port: 80 }]
            })

            expect(Object.isFrozen(service)).toBe(true)
        })
    })

    describe('parseServiceManifest', () => {
        it('should parse valid ClusterIP service manifest', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {
                    name: 'my-service',
                    namespace: 'default'
                },
                spec: {
                    ports: [{ port: 80, protocol: 'TCP' }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.name).toBe('my-service')
                expect(result.value.spec.type).toBe('ClusterIP')
                expect(result.value.spec.ports[0].port).toBe(80)
            }
        })

        it('should default type to ClusterIP if not specified', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'no-type-service' },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.type).toBe('ClusterIP')
            }
        })

        it('should default protocol to TCP if not specified', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'no-protocol-service' },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.ports[0].protocol).toBe('TCP')
            }
        })

        it('should parse service with selector', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'selector-service' },
                spec: {
                    selector: { app: 'myapp' },
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.selector).toEqual({ app: 'myapp' })
            }
        })

        it('should parse service with targetPort', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'targetport-service' },
                spec: {
                    ports: [{ port: 80, targetPort: 8080 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.ports[0].targetPort).toBe(8080)
            }
        })

        it('should parse service with targetPort as string', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'named-targetport-service' },
                spec: {
                    ports: [{ port: 80, targetPort: 'http' }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.ports[0].targetPort).toBe('http')
            }
        })

        it('should parse service with multiple ports', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'multi-port-service' },
                spec: {
                    ports: [
                        { name: 'http', port: 80 },
                        { name: 'https', port: 443 }
                    ]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.ports).toHaveLength(2)
            }
        })

        it('should parse service with clusterIP', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'clusterip-service' },
                spec: {
                    clusterIP: '10.96.0.1',
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.clusterIP).toBe('10.96.0.1')
            }
        })

        it('should parse headless service with clusterIP None', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'headless-service' },
                spec: {
                    clusterIP: 'None',
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.clusterIP).toBe('None')
            }
        })

        it('should default namespace to "default"', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'no-ns-service' },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.namespace).toBe('default')
            }
        })

        it('should parse manifest with labels', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {
                    name: 'labeled-service',
                    labels: { app: 'test', tier: 'backend' }
                },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.labels).toEqual({
                    app: 'test',
                    tier: 'backend'
                })
            }
        })

        it('should parse manifest with annotations', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {
                    name: 'annotated-service',
                    annotations: { note: 'important' }
                },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.annotations).toEqual({
                    note: 'important'
                })
            }
        })

        it('should return error for missing name', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {},
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toContain('Invalid Service manifest')
            }
        })

        it('should return error for missing ports', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'no-ports-service' },
                spec: {}
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should return error for empty ports array', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'empty-ports-service' },
                spec: {
                    ports: []
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should return error for wrong apiVersion', () => {
            const manifest = {
                apiVersion: 'v2',
                kind: 'Service',
                metadata: { name: 'test' },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should return error for wrong kind', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: { name: 'test' },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should return error for invalid protocol', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'invalid-protocol-service' },
                spec: {
                    ports: [{ port: 80, protocol: 'INVALID' }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should parse UDP protocol', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'udp-service' },
                spec: {
                    ports: [{ port: 53, protocol: 'UDP' }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.ports[0].protocol).toBe('UDP')
            }
        })

        it('should parse SCTP protocol', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'sctp-service' },
                spec: {
                    ports: [{ port: 80, protocol: 'SCTP' }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.ports[0].protocol).toBe('SCTP')
            }
        })

        it('should preserve creationTimestamp from manifest', () => {
            const timestamp = '2024-06-01T12:00:00Z'
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: {
                    name: 'timed-service',
                    creationTimestamp: timestamp
                },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.creationTimestamp).toBe(timestamp)
            }
        })

        it('should freeze the parsed service', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'frozen' },
                spec: {
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(Object.isFrozen(result.value)).toBe(true)
            }
        })
    })

    describe('getServiceType', () => {
        it('should return ClusterIP for default service', () => {
            const service = createService({
                name: 'clusterip',
                namespace: 'default',
                ports: [{ port: 80 }]
            })

            expect(getServiceType(service)).toBe('ClusterIP')
        })

        it('should return NodePort for NodePort service', () => {
            const service = createService({
                name: 'nodeport',
                namespace: 'default',
                ports: [{ port: 80 }],
                type: 'NodePort'
            })

            expect(getServiceType(service)).toBe('NodePort')
        })

        it('should return LoadBalancer for LoadBalancer service', () => {
            const service = createService({
                name: 'loadbalancer',
                namespace: 'default',
                ports: [{ port: 80 }],
                type: 'LoadBalancer'
            })

            expect(getServiceType(service)).toBe('LoadBalancer')
        })

        it('should return ExternalName for ExternalName service', () => {
            const service = createService({
                name: 'externalname',
                namespace: 'default',
                ports: [{ port: 80 }],
                type: 'ExternalName',
                externalName: 'example.com'
            })

            expect(getServiceType(service)).toBe('ExternalName')
        })
    })

    describe('Advanced service types', () => {
        it('should create NodePort service with nodePort', () => {
            const service = createService({
                name: 'nodeport-service',
                namespace: 'default',
                type: 'NodePort',
                ports: [{ port: 80, nodePort: 30080 }]
            })

            expect(service.spec.type).toBe('NodePort')
            expect(service.spec.ports[0].nodePort).toBe(30080)
        })

        it('should create LoadBalancer service with status', () => {
            const service = createService({
                name: 'loadbalancer-service',
                namespace: 'default',
                type: 'LoadBalancer',
                ports: [{ port: 80 }],
                status: {
                    loadBalancer: {
                        ingress: [{ ip: '192.168.1.100' }]
                    }
                }
            })

            expect(service.spec.type).toBe('LoadBalancer')
            expect(service.status?.loadBalancer?.ingress?.[0]?.ip).toBe('192.168.1.100')
        })

        it('should create ExternalName service', () => {
            const service = createService({
                name: 'externalname-service',
                namespace: 'default',
                type: 'ExternalName',
                externalName: 'external.example.com',
                ports: [{ port: 80 }]
            })

            expect(service.spec.type).toBe('ExternalName')
            expect(service.spec.externalName).toBe('external.example.com')
        })

        it('should parse NodePort service from YAML', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'nodeport' },
                spec: {
                    type: 'NodePort',
                    ports: [{ port: 80, nodePort: 30080 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.type).toBe('NodePort')
                expect(result.value.spec.ports[0].nodePort).toBe(30080)
            }
        })

        it('should parse LoadBalancer service from YAML', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'loadbalancer' },
                spec: {
                    type: 'LoadBalancer',
                    ports: [{ port: 80 }]
                },
                status: {
                    loadBalancer: {
                        ingress: [{ ip: '192.168.1.100' }]
                    }
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.type).toBe('LoadBalancer')
                expect(result.value.status?.loadBalancer?.ingress?.[0]?.ip).toBe('192.168.1.100')
            }
        })

        it('should parse ExternalName service from YAML', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Service',
                metadata: { name: 'externalname' },
                spec: {
                    type: 'ExternalName',
                    externalName: 'external.example.com',
                    ports: [{ port: 80 }]
                }
            }

            const result = parseServiceManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.spec.type).toBe('ExternalName')
                expect(result.value.spec.externalName).toBe('external.example.com')
            }
        })
    })
})
