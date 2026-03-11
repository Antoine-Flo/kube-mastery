import { describe, expect, it } from 'vitest'
import { handleLogs } from '../../../../../src/core/kubectl/commands/handlers/logs'
import { createNamespace } from '../../../../../src/core/cluster/ressources/Namespace'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl logs handler', () => {
  const createState = (pods: ReturnType<typeof createPod>[]) =>
    createClusterStateData({ pods })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
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

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('error: pod name is required')
      }
    })

    it('should return error when pod is not found', () => {
      const state = createState([])
      const parsed = createParsedCommand({ name: 'nonexistent' })

      const result = handleLogs(state, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('NotFound')
        expect(result.error).toContain('nonexistent')
        expect(result.error).toContain('namespace "default"')
      }
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

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('NotFound')
        expect(result.error).toContain('namespace "other-namespace"')
      }
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

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
      }
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

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('container name must be specified')
        expect(result.error).toContain('app')
        expect(result.error).toContain('sidecar')
      }
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

      expect(result.ok).toBe(true)
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

      expect(result.ok).toBe(true)
    })

    it('should return startup profile logs for nginx main-app with tail', () => {
      const pod = createPod({
        name: 'multi-container-pod',
        namespace: 'default',
        containers: [
          { name: 'main-app', image: 'nginx:1.28' },
          { name: 'sidecar', image: 'redis:7.0' }
        ]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'multi-container-pod',
        flags: { c: 'main-app', tail: '5' }
      })

      const result = handleLogs(state, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toBe(
        [
          '2026/03/11 12:18:12 [notice] 1#1: start worker process 55',
          '2026/03/11 12:18:12 [notice] 1#1: start worker process 56',
          '2026/03/11 12:18:12 [notice] 1#1: start worker process 57',
          '2026/03/11 12:18:12 [notice] 1#1: start worker process 58',
          '2026/03/11 12:18:12 [notice] 1#1: start worker process 59'
        ].join('\n')
      )
    })

    it('should return startup profile logs for redis sidecar with tail', () => {
      const pod = createPod({
        name: 'multi-container-pod',
        namespace: 'default',
        containers: [
          { name: 'main-app', image: 'nginx:1.28' },
          { name: 'sidecar', image: 'redis:7.0' }
        ]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'multi-container-pod',
        flags: { c: 'sidecar', tail: '5' }
      })

      const result = handleLogs(state, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toBe(
        [
          '1:C 11 Mar 2026 12:18:16.565 # Warning: no config file specified, using the default config. In order to specify a config file use redis-server /path/to/redis.conf',
          '1:M 11 Mar 2026 12:18:16.565 * monotonic clock: POSIX clock_gettime',
          '1:M 11 Mar 2026 12:18:16.566 * Running mode=standalone, port=6379.',
          '1:M 11 Mar 2026 12:18:16.566 # Server initialized',
          '1:M 11 Mar 2026 12:18:16.566 * Ready to accept connections'
        ].join('\n')
      )
    })

    it('should return error for non-existent container', () => {
      const pod = createPod({
        name: 'multi-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'multi-pod',
        flags: { c: 'nonexistent' }
      })

      const result = handleLogs(state, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe(
          'error: container nonexistent is not valid for pod multi-pod'
        )
      }
    })

    it('should allow accessing init container logs with -c', () => {
      const pod = createPod({
        name: 'init-pod',
        namespace: 'default',
        initContainers: [{ name: 'init', image: 'busybox:latest' }],
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'init-pod',
        flags: { c: 'init' }
      })

      const result = handleLogs(state, parsed)

      expect(result.ok).toBe(true)
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

      expect(result).toEqual({ ok: true, value: 'line4\nline5' })
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

      expect(result).toEqual({ ok: true, value: '' })
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

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('invalid argument "invalid"')
        expect(result.error).toContain('kubectl logs --help')
      }
    })

    it('should return full logs for negative --tail value', () => {
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

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
      }
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

      expect(result.ok).toBe(true)
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

      expect(result.ok).toBe(true)
    })

    it('should fail when target namespace does not exist', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      })
      const state = createClusterStateData({
        pods: [pod],
        namespaces: [createNamespace({ name: 'default' })]
      })
      const parsed = createParsedCommand({
        name: 'nginx-pod',
        namespace: 'dev'
      })

      const result = handleLogs(state, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('namespaces "dev" not found')
      }
    })
  })
})
