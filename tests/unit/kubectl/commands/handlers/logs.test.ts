import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { handleLogs as handleLogsApi } from '../../../../../src/core/kubectl/commands/handlers/logs'
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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('error: pod name is required')
      }
    })

    it('should return error when pod is not found', () => {
      const state = createState([])
      const parsed = createParsedCommand({ name: 'nonexistent' })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const lines = result.value.split('\n')
      expect(lines).toHaveLength(5)
      const hasNginxNoticeLines = lines.every((line) => {
        return line.includes('[notice] 1#1:')
      })
      expect(hasNginxNoticeLines).toBe(true)
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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      const lines = result.value.split('\n')
      expect(lines).toHaveLength(5)
      const hasRedisContent = lines.some((line) => {
        return (
          line.includes('Background saving') ||
          line.includes('Ready to accept') ||
          line.includes('DB 0:') ||
          line.includes('Accepted connection')
        )
      })
      expect(hasRedisContent).toBe(true)
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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBeGreaterThan(0)
      }
    })
  })

  describe('--since flag', () => {
    it('should filter logs newer than duration', () => {
      const nowMs = Date.now()
      const oldLine = `${new Date(nowMs - 2 * 60 * 1000).toISOString().substring(0, 19)}Z INFO old`
      const recentLine = `${new Date(nowMs - 10 * 1000).toISOString().substring(0, 19)}Z INFO recent`
      const pod = createPod({
        name: 'since-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        logs: [oldLine, recentLine]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'since-pod',
        flags: { since: '30s' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result).toEqual({ ok: true, value: recentLine })
    })

    it('should return kubectl-like error for invalid duration', () => {
      const pod = createPod({
        name: 'since-invalid',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'since-invalid',
        flags: { since: 'abc' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('invalid argument "abc"')
        expect(result.error).toContain('"--since"')
      }
    })

    it('should apply --since before --tail', () => {
      const nowMs = Date.now()
      const staleLine = `${new Date(nowMs - 5 * 60 * 1000).toISOString().substring(0, 19)}Z INFO stale`
      const recent1 = `${new Date(nowMs - 25 * 1000).toISOString().substring(0, 19)}Z INFO r1`
      const recent2 = `${new Date(nowMs - 15 * 1000).toISOString().substring(0, 19)}Z INFO r2`
      const recent3 = `${new Date(nowMs - 5 * 1000).toISOString().substring(0, 19)}Z INFO r3`
      const pod = createPod({
        name: 'since-tail',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        logs: [staleLine, recent1, recent2, recent3]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'since-tail',
        flags: { since: '30s', tail: '2' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result).toEqual({ ok: true, value: `${recent2}\n${recent3}` })
    })

    it('should support --previous with --since', () => {
      const nowMs = Date.now()
      const oldPrevious = `${new Date(nowMs - 4 * 60 * 1000).toISOString().substring(0, 19)}Z INFO old-previous`
      const recentPrevious = `${new Date(nowMs - 10 * 1000).toISOString().substring(0, 19)}Z INFO recent-previous`
      const pod = createPod({
        name: 'previous-since',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        containerStatusOverrides: [{ name: 'app', restartCount: 1 }],
        previousLogs: [oldPrevious, recentPrevious]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'previous-since',
        flags: { previous: true, since: '30s' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result).toEqual({ ok: true, value: recentPrevious })
    })

    it('should not leak old lines on first generation with --since', () => {
      const fixedNow = Date.parse('2026-03-17T14:21:47Z')
      vi.useFakeTimers()
      vi.setSystemTime(fixedNow)

      const pod = createPod({
        name: 'log-demo',
        namespace: 'default',
        creationTimestamp: '2026-03-17T14:19:30Z',
        startTime: '2026-03-17T14:19:30Z',
        containers: [{ name: 'app', image: 'generic:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'log-demo',
        flags: { since: '1m' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        const lines = result.value.length === 0 ? [] : result.value.split('\n')
        for (const line of lines) {
          const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/)
          expect(match).not.toBeNull()
          if (match != null) {
            const timestampMs = Date.parse(match[1])
            expect(timestampMs).toBeGreaterThanOrEqual(fixedNow - 60_000)
            expect(timestampMs).toBeLessThanOrEqual(fixedNow)
          }
        }
      }

      vi.useRealTimers()
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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('namespaces "dev" not found')
      }
    })
  })

  describe('--previous flag', () => {
    it('should return error when --previous is used but container has no restarts', () => {
      const pod = createPod({
        name: 'crashy',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'crashy',
        flags: { previous: true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('unable to retrieve container logs for')
        expect(result.error).toContain('containerd://')
      }
    })

    it('should return previous logs when --previous is used and container has restarted', () => {
      const previousLogLines = [
        '[previous] error at startup',
        '[previous] exit code 1'
      ]
      const pod = createPod({
        name: 'crashy',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        containerStatusOverrides: [{ name: 'app', restartCount: 1 }],
        previousLogs: previousLogLines
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'crashy',
        flags: { previous: true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(previousLogLines.join('\n'))
      }
    })
  })

  describe('crash-style logs (sh -c "exit 1")', () => {
    it('should end generated logs with crash line for busybox exit 1', () => {
      const pod = createPod({
        name: 'crashy',
        namespace: 'default',
        containers: [
          {
            name: 'app',
            image: 'busybox:1.36',
            command: ['sh'],
            args: ['-c', 'exit 1']
          }
        ]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({ name: 'crashy' })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleLogsApi(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.trim().endsWith('/bin/sh: exit 1')).toBe(true)
      }
    })
  })
})
