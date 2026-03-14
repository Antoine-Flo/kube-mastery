import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { handleExec as handleExecApi } from '../../../../../src/core/kubectl/commands/handlers/exec'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createDnsResolver } from '../../../../../src/core/network/DnsResolver'
import { createNetworkState } from '../../../../../src/core/network/NetworkState'
import { createTrafficEngine } from '../../../../../src/core/network/TrafficEngine'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl exec handler', () => {
  const createState = (pods: ReturnType<typeof createPod>[]) =>
    createClusterStateData({ pods })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toBe('Error: pod name is required')
    })

    it('should return error when command is not provided', () => {
      const state = createState([])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: undefined
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toContain('command must be specified')
    })

    it('should return error when execCommand is empty array', () => {
      const state = createState([])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: []
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toContain('command must be specified')
    })

    it('should return error when pod is not found', () => {
      const state = createState([])
      const parsed = createParsedCommand({
        name: 'nonexistent',
        execCommand: ['ls']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toContain('PATH=')
      expect(result).toContain('HOME=/root')
      expect(result).toContain('HOSTNAME=my-pod')
    })
  })

  describe('network commands', () => {
    it('should execute nslookup with network runtime', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'busybox' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const networkState = createNetworkState()
      networkState.upsertServiceRuntime({
        namespace: 'default',
        serviceName: 'web',
        serviceType: 'ClusterIP',
        clusterIP: '10.96.99.10',
        ports: [{ protocol: 'TCP', port: 80, targetPort: 8080 }],
        endpoints: []
      })
      const dnsResolver = createDnsResolver(networkState)
      const trafficEngine = createTrafficEngine(networkState, dnsResolver)
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['nslookup', 'web.default.svc.cluster.local']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed, {
        state: networkState,
        dnsResolver,
        trafficEngine,
        controller: {
          start: () => {},
          stop: () => {},
          initialSync: () => {},
          resyncAll: () => {},
          getState: () => networkState
        }
      })
      expect(result).toContain('Name:\tweb.default.svc.cluster.local')
      expect(result).toContain('Address:\t10.96.99.10')
    })

    it('should execute curl with network runtime', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'busybox' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const networkState = createNetworkState()
      networkState.upsertServiceRuntime({
        namespace: 'default',
        serviceName: 'web',
        serviceType: 'ClusterIP',
        clusterIP: '10.96.99.11',
        ports: [{ protocol: 'TCP', port: 80, targetPort: 8080 }],
        endpoints: [
          {
            podName: 'web-1',
            namespace: 'default',
            podIP: '10.244.2.2',
            targetPort: 8080
          }
        ]
      })
      const dnsResolver = createDnsResolver(networkState)
      const trafficEngine = createTrafficEngine(networkState, dnsResolver)
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['curl', 'http://web.default.svc.cluster.local']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed, {
        state: networkState,
        dnsResolver,
        trafficEngine,
        controller: {
          start: () => {},
          stop: () => {},
          initialSync: () => {},
          resyncAll: () => {},
          getState: () => networkState
        }
      })
      expect(result).toContain('200 OK')
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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

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

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toBe('ENTER_CONTAINER:my-pod:main:production')
    })
  })
})
