import { describe, expect, it } from 'vitest'
import {
    createSecret,
    encodeBase64,
    parseSecretManifest
} from '../../../../src/core/cluster/ressources/Secret'
import { decodeBase64 } from '../../helpers/utils'

describe('Secret', () => {
    describe('encodeBase64', () => {
        it('should encode simple string', () => {
            const result = encodeBase64('hello')
            expect(result).toBe('aGVsbG8=')
        })

        it('should encode empty string', () => {
            const result = encodeBase64('')
            expect(result).toBe('')
        })

        it('should encode string with special characters', () => {
            const result = encodeBase64('user:password')
            expect(result).toBe('dXNlcjpwYXNzd29yZA==')
        })

        it('should encode unicode characters', () => {
            const result = encodeBase64('héllo wörld')
            expect(result).toBeTruthy()
            // Decode should give back the same
            expect(decodeBase64(result)).toBe('héllo wörld')
        })

        it('should encode JSON string', () => {
            const json = JSON.stringify({ key: 'value' })
            const result = encodeBase64(json)
            expect(decodeBase64(result)).toBe(json)
        })
    })

    describe('decodeBase64', () => {
        it('should decode simple string', () => {
            const result = decodeBase64('aGVsbG8=')
            expect(result).toBe('hello')
        })

        it('should decode empty string', () => {
            const result = decodeBase64('')
            expect(result).toBe('')
        })

        it('should decode string with special characters', () => {
            const result = decodeBase64('dXNlcjpwYXNzd29yZA==')
            expect(result).toBe('user:password')
        })

        it('should be inverse of encodeBase64', () => {
            const original = 'test string with spaces'
            const encoded = encodeBase64(original)
            const decoded = decodeBase64(encoded)
            expect(decoded).toBe(original)
        })
    })

    describe('createSecret', () => {
        it('should create secret with Opaque type', () => {
            const secret = createSecret({
                name: 'my-secret',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: { password: encodeBase64('secret123') }
            })

            expect(secret.apiVersion).toBe('v1')
            expect(secret.kind).toBe('Secret')
            expect(secret.metadata.name).toBe('my-secret')
            expect(secret.metadata.namespace).toBe('default')
            expect(secret.type).toEqual({ type: 'Opaque' })
            expect(secret.data.password).toBe(encodeBase64('secret123'))
        })

        it('should create secret with service-account-token type', () => {
            const secret = createSecret({
                name: 'sa-token',
                namespace: 'kube-system',
                secretType: {
                    type: 'kubernetes.io/service-account-token',
                    serviceAccountName: 'default'
                },
                data: { token: 'eyJhbG...' }
            })

            expect(secret.type).toEqual({
                type: 'kubernetes.io/service-account-token',
                serviceAccountName: 'default'
            })
        })

        it('should create secret with dockerconfigjson type', () => {
            const dockerConfig = JSON.stringify({
                auths: { 'registry.example.com': { auth: 'base64creds' } }
            })

            const secret = createSecret({
                name: 'docker-registry',
                namespace: 'default',
                secretType: {
                    type: 'kubernetes.io/dockerconfigjson',
                    dockerConfigJson: dockerConfig
                },
                data: { '.dockerconfigjson': encodeBase64(dockerConfig) }
            })

            expect(secret.type.type).toBe('kubernetes.io/dockerconfigjson')
        })

        it('should include labels when provided', () => {
            const secret = createSecret({
                name: 'labeled-secret',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: {},
                labels: { app: 'myapp', env: 'prod' }
            })

            expect(secret.metadata.labels).toEqual({ app: 'myapp', env: 'prod' })
        })

        it('should include annotations when provided', () => {
            const secret = createSecret({
                name: 'annotated-secret',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: {},
                annotations: { 'kubernetes.io/description': 'My secret' }
            })

            expect(secret.metadata.annotations).toEqual({
                'kubernetes.io/description': 'My secret'
            })
        })

        it('should use provided creationTimestamp', () => {
            const timestamp = '2024-01-15T10:30:00Z'
            const secret = createSecret({
                name: 'timed-secret',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: {},
                creationTimestamp: timestamp
            })

            expect(secret.metadata.creationTimestamp).toBe(timestamp)
        })

        it('should generate creationTimestamp if not provided', () => {
            const secret = createSecret({
                name: 'auto-timed-secret',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: {}
            })

            expect(secret.metadata.creationTimestamp).toBeTruthy()
            expect(secret.metadata.creationTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        })

        it('should freeze the returned secret object', () => {
            const secret = createSecret({
                name: 'frozen-secret',
                namespace: 'default',
                secretType: { type: 'Opaque' },
                data: { key: 'value' }
            })

            expect(Object.isFrozen(secret)).toBe(true)
        })
    })

    describe('parseSecretManifest', () => {
        it('should parse valid Opaque secret manifest', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'my-secret',
                    namespace: 'default'
                },
                type: 'Opaque',
                data: {
                    username: encodeBase64('admin'),
                    password: encodeBase64('secret')
                }
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.name).toBe('my-secret')
                expect(result.value.type).toEqual({ type: 'Opaque' })
            }
        })

        it('should parse manifest without explicit type as Opaque', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'no-type-secret'
                },
                data: {
                    key: 'value'
                }
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.type).toEqual({ type: 'Opaque' })
            }
        })

        it('should parse service-account-token secret', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'sa-token-secret',
                    namespace: 'kube-system'
                },
                type: 'kubernetes.io/service-account-token',
                data: {
                    token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
                }
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.type.type).toBe('kubernetes.io/service-account-token')
                if (result.value.type.type === 'kubernetes.io/service-account-token') {
                    expect(result.value.type.serviceAccountName).toBe('sa-token-secret')
                }
            }
        })

        it('should parse dockerconfigjson secret', () => {
            const dockerConfig = encodeBase64(JSON.stringify({
                auths: { 'docker.io': { auth: 'xyz' } }
            }))

            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'docker-secret'
                },
                type: 'kubernetes.io/dockerconfigjson',
                data: {
                    '.dockerconfigjson': dockerConfig
                }
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.type.type).toBe('kubernetes.io/dockerconfigjson')
            }
        })

        it('should default namespace to "default"', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'no-ns-secret'
                },
                data: {}
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.namespace).toBe('default')
            }
        })

        it('should parse manifest with labels', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'labeled-secret',
                    labels: { app: 'test', tier: 'backend' }
                },
                data: {}
            }

            const result = parseSecretManifest(manifest)

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
                kind: 'Secret',
                metadata: {
                    name: 'annotated-secret',
                    annotations: { note: 'important' }
                },
                data: {}
            }

            const result = parseSecretManifest(manifest)

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
                kind: 'Secret',
                metadata: {},
                data: {}
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toContain('Invalid Secret manifest')
            }
        })

        it('should return error for wrong apiVersion', () => {
            const manifest = {
                apiVersion: 'v2',
                kind: 'Secret',
                metadata: { name: 'test' },
                data: {}
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should return error for wrong kind', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'ConfigMap',
                metadata: { name: 'test' },
                data: {}
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should return error for missing data field', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: { name: 'test' }
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(false)
        })

        it('should treat unknown type as Opaque', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: { name: 'custom-type' },
                type: 'custom.io/my-secret-type',
                data: { key: 'value' }
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.type).toEqual({ type: 'Opaque' })
            }
        })

        it('should preserve creationTimestamp from manifest', () => {
            const timestamp = '2024-06-01T12:00:00Z'
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: {
                    name: 'timed-secret',
                    creationTimestamp: timestamp
                },
                data: {}
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value.metadata.creationTimestamp).toBe(timestamp)
            }
        })

        it('should freeze the parsed secret', () => {
            const manifest = {
                apiVersion: 'v1',
                kind: 'Secret',
                metadata: { name: 'frozen' },
                data: {}
            }

            const result = parseSecretManifest(manifest)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(Object.isFrozen(result.value)).toBe(true)
            }
        })
    })
})
