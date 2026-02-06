import { beforeEach, describe, expect, it } from 'vitest'
import { handleClusterInfo } from '../../../../../src/core/kubectl/commands/handlers/clusterInfo'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createClusterState, type ClusterState } from '../../../../../src/core/cluster/ClusterState'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import type { ClusterStateData } from '../../../../../src/core/cluster/ClusterState'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl cluster-info handler (with dump subcommand)', () => {
    let clusterState: ClusterState
    let stateData: ClusterStateData

    beforeEach(() => {
        const eventBus = createEventBus()
        clusterState = createClusterState(eventBus)

        // Add some test resources
        const pod = createPod({
            name: 'test-pod',
            namespace: 'default',
            containers: [{ name: 'nginx', image: 'nginx:latest' }],
            phase: 'Running',
            logs: ['Log line 1', 'Log line 2'],
        })
        clusterState.addPod(pod)

        const configMap = createConfigMap({
            name: 'test-cm',
            namespace: 'default',
            data: { key1: 'value1' },
        })
        clusterState.addConfigMap(configMap)

        const secret = createSecret({
            name: 'test-secret',
            namespace: 'default',
            secretType: { type: 'Opaque' },
            data: { password: Buffer.from('secret123').toString('base64') },
        })
        clusterState.addSecret(secret)

        stateData = clusterState.toJSON()
    })

    const createParsedCommand = (overrides: Partial<ParsedCommand> = {}): ParsedCommand => ({
        action: 'cluster-info',
        flags: {},
        ...overrides
    })

    describe('dump subcommand', () => {
        it('should dump cluster information with default namespaces', () => {
            const parsed = createParsedCommand({
                flags: { dump: true }
            })

            const result = handleClusterInfo(stateData, parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                // Default format is JSON
                expect(result.value).toContain('"kind": "NodeList"')
                expect(result.value).toContain('"kind": "EventList"')
                expect(result.value).toContain('"kind": "PodList"')
                expect(result.value).toContain('"kind": "ConfigMapList"')
                expect(result.value).toContain('"kind": "SecretList"')
                expect(result.value).toContain('"name": "test-pod"')
                expect(result.value).toContain('"name": "test-cm"')
                expect(result.value).toContain('"name": "test-secret"')
            }
        })

        it('should include pod logs in dump', () => {
            const parsed = createParsedCommand({
                flags: { dump: true }
            })

            const result = handleClusterInfo(stateData, parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                // Logs are plain text after JSON resources
                expect(result.value).toContain('==== START logs for pod default/test-pod ====')
                expect(result.value).toContain('Log line 1')
                expect(result.value).toContain('Log line 2')
                expect(result.value).toContain('==== END logs for pod default/test-pod ====')
            }
        })
    })

    describe('--all-namespaces flag', () => {
        it('should dump all namespaces when --all-namespaces is set', () => {
            // Add resources in different namespace
            const eventBus = createEventBus()
            const multiNsState = createClusterState(eventBus)
            multiNsState.addPod(createPod({
                name: 'pod1',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
            }))
            multiNsState.addPod(createPod({
                name: 'pod2',
                namespace: 'kube-system',
                containers: [{ name: 'kube-proxy', image: 'kube-proxy:latest' }],
            }))

            const parsed = createParsedCommand({
                flags: { dump: true, 'all-namespaces': true }
            })

            const result = handleClusterInfo(multiNsState.toJSON(), parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                // JSON format - check for pod names in JSON
                expect(result.value).toContain('"name": "pod1"')
                expect(result.value).toContain('"name": "pod2"')
                // Should have resources from multiple namespaces
                expect(result.value.split('"kind": "PodList"').length).toBeGreaterThan(1)
            }
        })

        it('should support -A shorthand for --all-namespaces', () => {
            const parsed = createParsedCommand({
                flags: { dump: true, 'A': true }
            })

            const result = handleClusterInfo(stateData, parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                // Should dump all namespaces (JSON format)
                expect(result.value).toContain('"kind": "PodList"')
            }
        })
    })

    describe('--namespaces flag', () => {
        it('should dump only specified namespaces', () => {
            // Add resources in multiple namespaces
            const eventBus = createEventBus()
            const multiNsState = createClusterState(eventBus)
            multiNsState.addPod(createPod({
                name: 'pod1',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
            }))
            multiNsState.addPod(createPod({
                name: 'pod2',
                namespace: 'production',
                containers: [{ name: 'app', image: 'app:latest' }],
            }))
            multiNsState.addPod(createPod({
                name: 'pod3',
                namespace: 'staging',
                containers: [{ name: 'app', image: 'app:latest' }],
            }))

            const parsed = createParsedCommand({
                flags: { dump: true, 'namespaces': 'default,production' }
            })

            const result = handleClusterInfo(multiNsState.toJSON(), parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                // JSON format - check for pod names
                expect(result.value).toContain('"name": "pod1"')
                expect(result.value).toContain('"name": "pod2"')
                expect(result.value).not.toContain('"name": "pod3"')
            }
        })
    })

    describe('output formats', () => {
        it('should dump in JSON format when --output json is specified', () => {
            const parsed = createParsedCommand({
                flags: { dump: true, output: 'json' }
            })

            const result = handleClusterInfo(stateData, parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value).toContain('"apiVersion": "v1"')
                expect(result.value).toContain('"kind": "PodList"')
                expect(result.value).toContain('"name": "test-pod"')
            }
        })

        it('should dump in YAML format when --output yaml is specified', () => {
            const parsed = createParsedCommand({
                flags: { dump: true, output: 'yaml' }
            })

            const result = handleClusterInfo(stateData, parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value).toContain('apiVersion: v1')
                expect(result.value).toContain('kind: PodList')
                expect(result.value).toContain('name: test-pod')
            }
        })

        it('should support -o shorthand for --output', () => {
            const parsed = createParsedCommand({
                flags: { dump: true, 'o': 'json' }
            })

            const result = handleClusterInfo(stateData, parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value).toContain('"apiVersion": "v1"')
            }
        })
    })

    describe('--output-directory flag', () => {
        it('should return error when --output-directory is specified', () => {
            const parsed = createParsedCommand({
                flags: { dump: true, 'output-directory': '/tmp/dump' }
            })

            const result = handleClusterInfo(stateData, parsed)

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toContain('--output-directory is not yet supported')
            }
        })

        it('should allow --output-directory=- (stdout)', () => {
            const parsed = createParsedCommand({
                flags: { dump: true, 'output-directory': '-' }
            })

            const result = handleClusterInfo(stateData, parsed)

            // Should succeed (stdout is allowed)
            expect(result.ok).toBe(true)
        })
    })

    describe('empty cluster', () => {
        it('should handle empty cluster gracefully', () => {
            const emptyState = createClusterStateData()

            const parsed = createParsedCommand({
                flags: { dump: true }
            })

            const result = handleClusterInfo(emptyState, parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                // JSON format with empty lists
                expect(result.value).toContain('"kind": "NodeList"')
                expect(result.value).toContain('"kind": "PodList"')
                expect(result.value).toContain('"kind": "ConfigMapList"')
                expect(result.value).toContain('"kind": "SecretList"')
                // Lists should be empty
                expect(result.value).toContain('"items": []')
            }
        })
    })

    describe('pods without logs', () => {
        it('should skip logs section when pod has no logs', () => {
            const eventBus = createEventBus()
            const state = createClusterState(eventBus)
            state.addPod(createPod({
                name: 'no-logs-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
                // No logs provided
            }))

            const parsed = createParsedCommand({
                flags: { dump: true }
            })

            const result = handleClusterInfo(state.toJSON(), parsed)

            expect(result.ok).toBe(true)
            if (result.ok) {
                expect(result.value).toContain('"name": "no-logs-pod"')
                // Should not have logs since pod has no logs
                expect(result.value).not.toContain('==== START logs for pod default/no-logs-pod ====')
            }
        })
    })
})
