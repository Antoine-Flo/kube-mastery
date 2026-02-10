import { describe, expect, it } from 'vitest'
import { handleExec } from '../../../../../src/core/kubectl/commands/handlers/exec'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl exec handler', () => {
  const createState = (pods: ReturnType<typeof createPod>[]) => createClusterStateData({ pods })

  const createParsedCommand = (overrides: Partial<ParsedCommand> = {}): ParsedCommand => ({
    action: 'exec',
    resource: 'pods',
    flags: {},
    ...overrides
  })

  describe('validation', () => {
    it('should return error when pod name is not provided', () => {
      const state = createState([])
      const parsed = createParsedCommand({
        name: undefined,
        execCommand: ['ls']
      })

      const result = handleExec(state, parsed)

      expect(result).toBe('Error: pod name is required')
    })

    it('should return error when command is not provided', () => {
      const state = createState([])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: undefined
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('command must be specified')
    })

    it('should return error when execCommand is empty array', () => {
      const state = createState([])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: []
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('command must be specified')
    })

    it('should return error when pod is not found', () => {
      const state = createState([])
      const parsed = createParsedCommand({
        name: 'nonexistent',
        execCommand: ['ls']
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('NotFound')
      expect(result).toContain('nonexistent')
    })

    it('should return error when pod is not running', () => {
      const pod = createPod({
        name: 'pending-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Pending'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'pending-pod',
        execCommand: ['ls']
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('not running')
      expect(result).toContain('Pending')
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
        ],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'multi-pod',
        execCommand: ['ls']
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('container name must be specified')
      expect(result).toContain('app')
      expect(result).toContain('sidecar')
    })

    it('should accept container with -c flag', () => {
      const pod = createPod({
        name: 'multi-pod',
        namespace: 'default',
        containers: [
          { name: 'app', image: 'nginx:latest' },
          { name: 'sidecar', image: 'redis:latest' }
        ],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'multi-pod',
        execCommand: ['ls'],
        flags: { c: 'app' }
      })

      const result = handleExec(state, parsed)

      expect(result).not.toContain('Error')
    })

    it('should accept container with --container flag', () => {
      const pod = createPod({
        name: 'multi-pod',
        namespace: 'default',
        containers: [
          { name: 'app', image: 'nginx:latest' },
          { name: 'sidecar', image: 'redis:latest' }
        ],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'multi-pod',
        execCommand: ['ls'],
        flags: { container: 'sidecar' }
      })

      const result = handleExec(state, parsed)

      expect(result).not.toContain('Error')
    })

    it('should return error for non-existent container', () => {
      const pod = createPod({
        name: 'multi-pod',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'multi-pod',
        execCommand: ['ls'],
        flags: { c: 'nonexistent' }
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('container nonexistent not found')
      expect(result).toContain('Available containers')
    })
  })

  describe('shell commands', () => {
    it('should return ENTER_CONTAINER for sh command', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['sh']
      })

      const result = handleExec(state, parsed)

      expect(result).toBe('ENTER_CONTAINER:my-pod:main:default')
    })

    it('should return ENTER_CONTAINER for bash command', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['bash']
      })

      const result = handleExec(state, parsed)

      expect(result).toBe('ENTER_CONTAINER:my-pod:main:default')
    })

    it('should return ENTER_CONTAINER for /bin/sh command', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['/bin/sh']
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('ENTER_CONTAINER')
    })

    it('should return ENTER_CONTAINER for /bin/bash command', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['/bin/bash']
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('ENTER_CONTAINER')
    })

    it('should include correct container in ENTER_CONTAINER with -c flag', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [
          { name: 'app', image: 'nginx:latest' },
          { name: 'sidecar', image: 'redis:latest' }
        ],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['sh'],
        flags: { c: 'sidecar' }
      })

      const result = handleExec(state, parsed)

      expect(result).toBe('ENTER_CONTAINER:my-pod:sidecar:default')
    })
  })

  describe('env command', () => {
    it('should return environment variables for env command', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['env']
      })

      const result = handleExec(state, parsed)

      expect(result).toContain('PATH=')
      expect(result).toContain('HOME=/root')
      expect(result).toContain('HOSTNAME=my-pod')
    })
  })

  describe('other commands', () => {
    it('should return SHELL_COMMAND for ls', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['ls', '-la']
      })

      const result = handleExec(state, parsed)

      expect(result).toBe('SHELL_COMMAND:ls -la')
    })

    it('should return SHELL_COMMAND for cat', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['cat', '/etc/nginx/nginx.conf']
      })

      const result = handleExec(state, parsed)

      expect(result).toBe('SHELL_COMMAND:cat /etc/nginx/nginx.conf')
    })
  })

  describe('namespace handling', () => {
    it('should default to default namespace', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['sh']
      })

      const result = handleExec(state, parsed)

      expect(result).toContain(':default')
    })

    it('should find pod in specified namespace', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'production',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        namespace: 'production',
        execCommand: ['sh']
      })

      const result = handleExec(state, parsed)

      expect(result).toBe('ENTER_CONTAINER:my-pod:main:production')
    })
  })
})
