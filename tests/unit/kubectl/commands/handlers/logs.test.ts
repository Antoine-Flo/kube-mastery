import { describe, expect, it } from 'vitest'
import { handleLogs } from '../../../../../src/core/kubectl/commands/handlers/logs'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl logs handler', () => {
    const createState = (pods: ReturnType<typeof createPod>[]) => 
        createClusterStateData({ pods })

    const createParsedCommand = (overrides: Partial<ParsedCommand> = {}): ParsedCommand => ({
        action: 'logs',
        resource: 'pods',
        flags: {},
        ...overrides
    })

    describe('basic usage', () => {
        it('should return error when pod name is not provided', () => {
            const state = createState([])
            const parsed = createParsedCommand({ name: undefined })

            const result = handleLogs(state, parsed)

            expect(result).toBe('Error: pod name is required')
        })

        it('should return error when pod is not found', () => {
            const state = createState([])
            const parsed = createParsedCommand({ name: 'nonexistent' })

            const result = handleLogs(state, parsed)

            expect(result).toContain('NotFound')
            expect(result).toContain('nonexistent')
        })

        it('should return error when pod not found in specified namespace', () => {
            const pod = createPod({
                name: 'my-pod',
                namespace: 'default',
                containers: [{ name: 'main', image: 'nginx:latest' }]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'my-pod',
                namespace: 'other-namespace'
            })

            const result = handleLogs(state, parsed)

            expect(result).toContain('NotFound')
        })

        it('should return logs for single container pod', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({ name: 'nginx-pod' })

            const result = handleLogs(state, parsed)

            // Should generate logs (not empty)
            expect(result).toBeTruthy()
            expect(result).not.toContain('Error')
        })
    })

    describe('multi-container pods', () => {
        it('should require container name for multi-container pod', () => {
            const pod = createPod({
                name: 'multi-pod',
                namespace: 'default',
                containers: [
                    { name: 'app', image: 'nginx:latest' },
                    { name: 'sidecar', image: 'redis:latest' }
                ]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({ name: 'multi-pod' })

            const result = handleLogs(state, parsed)

            expect(result).toContain('container name must be specified')
            expect(result).toContain('app')
            expect(result).toContain('sidecar')
        })

        it('should return logs for specified container with -c flag', () => {
            const pod = createPod({
                name: 'multi-pod',
                namespace: 'default',
                containers: [
                    { name: 'app', image: 'nginx:latest' },
                    { name: 'sidecar', image: 'redis:latest' }
                ]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'multi-pod',
                flags: { c: 'app' }
            })

            const result = handleLogs(state, parsed)

            expect(result).not.toContain('Error')
        })

        it('should return logs with --container flag', () => {
            const pod = createPod({
                name: 'multi-pod',
                namespace: 'default',
                containers: [
                    { name: 'app', image: 'nginx:latest' },
                    { name: 'sidecar', image: 'redis:latest' }
                ]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'multi-pod',
                flags: { container: 'sidecar' }
            })

            const result = handleLogs(state, parsed)

            expect(result).not.toContain('Error')
        })

        it('should return error for non-existent container', () => {
            const pod = createPod({
                name: 'multi-pod',
                namespace: 'default',
                containers: [
                    { name: 'app', image: 'nginx:latest' }
                ]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'multi-pod',
                flags: { c: 'nonexistent' }
            })

            const result = handleLogs(state, parsed)

            expect(result).toContain('container nonexistent not found')
            expect(result).toContain('Available containers')
        })

        it('should allow accessing init container logs with -c', () => {
            const pod = createPod({
                name: 'init-pod',
                namespace: 'default',
                initContainers: [
                    { name: 'init', image: 'busybox:latest' }
                ],
                containers: [
                    { name: 'main', image: 'nginx:latest' }
                ]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'init-pod',
                flags: { c: 'init' }
            })

            const result = handleLogs(state, parsed)

            expect(result).not.toContain('Error')
        })
    })

    describe('--tail flag', () => {
        it('should limit logs with --tail', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
                logs: ['line1', 'line2', 'line3', 'line4', 'line5']
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                flags: { tail: '2' }
            })

            const result = handleLogs(state, parsed)

            expect(result).toBe('line4\nline5')
        })

        it('should return empty for --tail=0', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
                logs: ['line1', 'line2', 'line3']
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                flags: { tail: '0' }
            })

            const result = handleLogs(state, parsed)

            expect(result).toBe('')
        })

        it('should return error for invalid --tail value', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                flags: { tail: 'invalid' }
            })

            const result = handleLogs(state, parsed)

            expect(result).toContain('Error')
            expect(result).toContain('positive number')
        })

        it('should return error for negative --tail value', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                flags: { tail: '-5' }
            })

            const result = handleLogs(state, parsed)

            expect(result).toContain('Error')
        })
    })

    describe('--follow flag', () => {
        it('should add follow message with -f flag', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
                logs: ['log line']
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                flags: { f: true }
            })

            const result = handleLogs(state, parsed)

            expect(result).toContain('following logs')
            expect(result).toContain('Ctrl+C')
        })

        it('should add follow message with --follow flag', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
                logs: ['log line']
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                flags: { follow: true }
            })

            const result = handleLogs(state, parsed)

            expect(result).toContain('following logs')
        })

        it('should not add follow message if no logs', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }],
                logs: []
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                flags: { f: true, tail: '0' }
            })

            const result = handleLogs(state, parsed)

            expect(result).not.toContain('following logs')
        })
    })

    describe('namespace handling', () => {
        it('should default to default namespace', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'default',
                containers: [{ name: 'nginx', image: 'nginx:latest' }]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({ name: 'nginx-pod' })

            const result = handleLogs(state, parsed)

            expect(result).not.toContain('Error')
        })

        it('should find pod in specified namespace', () => {
            const pod = createPod({
                name: 'nginx-pod',
                namespace: 'production',
                containers: [{ name: 'nginx', image: 'nginx:latest' }]
            })
            const state = createState([pod])
            const parsed = createParsedCommand({
                name: 'nginx-pod',
                namespace: 'production'
            })

            const result = handleLogs(state, parsed)

            expect(result).not.toContain('Error')
        })
    })
})
