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
    it('should add defaulted container notice when init container exists', () => {
      const pod = createPod({
        name: 'init-demo',
        namespace: 'default',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        initContainers: [{ name: 'write-data', image: 'busybox:1.36' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'init-demo',
        execCommand: ['cat', '/etc/hostname']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toContain('KUBECTL_STDERR:')
      expect(result).toContain(
        encodeURIComponent(
          'Defaulted container "app" out of: app, write-data (init)'
        )
      )
      expect(result).toContain('SHELL_COMMAND:default:init-demo:app:')
    })

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

      expect(result).toBe('ENTER_CONTAINER:default:my-pod:main')
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

      expect(result).toBe('ENTER_CONTAINER:default:my-pod:main')
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

      expect(result).toBe('ENTER_CONTAINER:default:my-pod:sidecar')
    })

    it('should return SHELL_COMMAND for sh -c one-shot script', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['sh', '-c', 'ls', '/tmp']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toBe(
        `SHELL_COMMAND:default:my-pod:main:${encodeURIComponent('ls /tmp')}`
      )
    })

    it('should return SHELL_COMMAND for /bin/sh -c multiline script', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const script = 'pwd\ncat /etc/hosts'
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['/bin/sh', '-c', script]
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toBe(
        `SHELL_COMMAND:default:my-pod:main:${encodeURIComponent(script)}`
      )
    })

    it('should return error when sh -c has no script', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['sh', '-c']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toContain('flag needs an argument')
    })
  })

  describe('env command', () => {
    it('should route env command through shell directive', () => {
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

      expect(result).toBe('SHELL_COMMAND:default:my-pod:main:env')
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
      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const trafficEngine = createTrafficEngine(
        networkState,
        dnsResolver,
        apiServer
      )
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['nslookup', 'web.default.svc.cluster.local']
      })

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
      expect(result).toContain('Address: 10.96.99.10')
    })

    it('should execute dig with deterministic WHEN line', () => {
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
      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const trafficEngine = createTrafficEngine(
        networkState,
        dnsResolver,
        apiServer
      )
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['dig', 'web.default.svc.cluster.local']
      })

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
      expect(result).toContain(';; WHEN: Wed, 01 Jan 2020 00:00:00 GMT')
      expect(result).toContain('10.96.99.10')
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
            targetPort: 8080,
            responseProfile: 'nginx'
          }
        ]
      })
      const dnsResolver = createDnsResolver(networkState)
      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const trafficEngine = createTrafficEngine(
        networkState,
        dnsResolver,
        apiServer
      )
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['curl', 'http://web.default.svc.cluster.local']
      })

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
      expect(result).toContain('<title>Welcome to nginx!</title>')
    })

    it('should execute curl -s with network runtime', () => {
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
            targetPort: 8080,
            responseProfile: 'nginx'
          }
        ]
      })
      const dnsResolver = createDnsResolver(networkState)
      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const trafficEngine = createTrafficEngine(
        networkState,
        dnsResolver,
        apiServer
      )
      const parsed = createParsedCommand({
        name: 'my-pod',
        execCommand: ['curl', '-s', 'http://web.default.svc.cluster.local']
      })

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
      expect(result).toContain('<h1>Welcome to nginx!</h1>')
    })
  })

  describe('other commands', () => {
    it('should return PROCESS_COMMAND for kill 1', () => {
      const pod = createPod({
        name: 'busybox-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'busybox:1.36' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'busybox-pod',
        execCommand: ['kill', '1']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toBe('PROCESS_COMMAND:pid1:kill:default:busybox-pod:main')
    })

    it('should return PROCESS_COMMAND for nginx -s stop', () => {
      const pod = createPod({
        name: 'nginx-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'nginx-pod',
        execCommand: ['nginx', '-s', 'stop']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toBe('PROCESS_COMMAND:nginx:stop:default:nginx-pod:main')
    })

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

      expect(result).toBe('SHELL_COMMAND:default:my-pod:main:ls%20-la')
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

      expect(result).toBe(
        'SHELL_COMMAND:default:my-pod:main:cat%20%2Fetc%2Fnginx%2Fnginx.conf'
      )
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

      expect(result).toBe('ENTER_CONTAINER:production:my-pod:main')
    })
  })

  describe('resource target resolution', () => {
    it('should resolve deployment/name target to a pod in namespace', () => {
      const pod = createPod({
        name: 'frontend-7f6d9c4b5d-abcde',
        namespace: 'default',
        labels: { app: 'frontend' },
        containers: [{ name: 'main', image: 'nginx:latest' }],
        phase: 'Running'
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'deploy/frontend',
        execCommand: ['ls', '-la']
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(state)
      const result = handleExecApi(apiServer, parsed)

      expect(result).toBe(
        'SHELL_COMMAND:default:frontend-7f6d9c4b5d-abcde:main:ls%20-la'
      )
    })
  })
})
