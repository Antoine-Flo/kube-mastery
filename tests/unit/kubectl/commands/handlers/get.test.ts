import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createServiceEndpointSlice } from '../../../../../src/core/cluster/ressources/EndpointSlice'
import { createEndpoints } from '../../../../../src/core/cluster/ressources/Endpoints'
import { createEvent } from '../../../../../src/core/cluster/ressources/Event'
import { createNode } from '../../../../../src/core/cluster/ressources/Node'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl get handler - multi resource list', () => {
  it('renders comma-separated resources in sequence', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web',
        namespace: 'default',
        containers: [{ name: 'web', image: 'nginx:1.28' }]
      })
    )
    apiServer.createResource(
      'ConfigMap',
      createConfigMap({
        name: 'app-config',
        namespace: 'default',
        data: { MODE: 'dev' }
      })
    )
    apiServer.createResource(
      'Secret',
      createSecret({
        name: 'app-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: { TOKEN: 'YWJjMTIz' }
      })
    )

    const parsed: ParsedCommand = {
      action: 'get',
      resource: 'pods',
      resourceList: ['pods', 'configmaps', 'secrets'],
      flags: {},
      namespace: 'default'
    }
    const output = handleGet(apiServer, parsed)

    expect(output).toContain('NAME')
    expect(output).toContain('web')
    expect(output).toContain('app-config')
    expect(output).toContain('app-secret')
  })
})

describe('kubectl get handler - nodes', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createState = () => {
    // Create nodes directly in ClusterStateData for testing
    // (since Node events are not yet implemented)
    const controlPlaneNode = createNode({
      name: 'control-plane',
      labels: {
        'node-role.kubernetes.io/control-plane': '',
        'kubernetes.io/os': 'linux'
      },
      status: {
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://2.2.0',
          kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
          kubeletVersion: 'v1.35.0',
          operatingSystem: 'linux',
          osImage: 'Debian GNU/Linux 12 (bookworm)'
        },
        addresses: [
          {
            type: 'InternalIP',
            address: '172.18.0.2'
          },
          {
            type: 'Hostname',
            address: 'control-plane'
          }
        ],
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            reason: 'KubeletNotReady',
            message: 'container runtime network not ready'
          }
        ]
      },
      creationTimestamp: '2024-01-16T18:03:00Z'
    })

    const workerNode = createNode({
      name: 'worker-node-1',
      labels: {
        'node-role.kubernetes.io/worker': '',
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
        ],
        conditions: [
          {
            type: 'Ready',
            status: 'True'
          }
        ]
      },
      creationTimestamp: '2024-01-16T18:03:00Z'
    })

    return createClusterStateData({ nodes: [controlPlaneNode, workerNode] })
  }

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'get',
    resource: 'nodes',
    flags: {},
    ...overrides
  })

  describe('table format (default)', () => {
    it('should list nodes in table format', () => {
      const state = createState()
      const parsed = createParsedCommand()

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('NAME')
      expect(result).toContain('STATUS')
      expect(result).toContain('ROLES')
      expect(result).toContain('AGE')
      expect(result).toContain('VERSION')
      expect(result).toContain('control-plane')
      expect(result).toContain('worker-node-1')
      expect(result).toContain('NotReady')
      expect(result).toContain('Ready')
      expect(result).toContain('control-plane')
      expect(result).toContain('worker')
      expect(result).toContain('v1.35.0')
      expect(result).toContain('v1.28.0')
    })

    it('should return "No resources found" when no nodes exist', () => {
      const state = createClusterStateData()
      const parsed = createParsedCommand()

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toBe('No resources found')
    })
  })

  describe('wide format', () => {
    it('should list nodes with wide output format', () => {
      const state = createState()
      const parsed = createParsedCommand({
        flags: { output: 'wide' }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('NAME')
      expect(result).toContain('STATUS')
      expect(result).toContain('ROLES')
      expect(result).toContain('AGE')
      expect(result).toContain('VERSION')
      expect(result).toContain('INTERNAL-IP')
      expect(result).toContain('EXTERNAL-IP')
      expect(result).toContain('OS-IMAGE')
      expect(result).toContain('KERNEL-VERSION')
      expect(result).toContain('CONTAINER-RUNTIME')
      expect(result).toContain('172.18.0.2')
      expect(result).toContain('192.168.1.10')
      expect(result).toContain('203.0.113.10')
      expect(result).toContain('Debian GNU/Linux 12 (bookworm)')
      expect(result).toContain('Ubuntu 22.04')
      expect(result).toContain('containerd://2.2.0')
      expect(result).toContain('containerd://1.6.0')
    })
  })

  describe('JSON format', () => {
    it('should return nodes in JSON format', () => {
      const state = createState()
      const parsed = createParsedCommand({
        flags: { output: 'json' }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('"apiVersion": "v1"')
      expect(result).toContain('"kind": "List"')
      expect(result).toContain('"items"')
      expect(result).toContain('"control-plane"')
      expect(result).toContain('"worker-node-1"')
      expect(result).toContain('"kubeletVersion": "v1.35.0"')
      expect(result).toContain('"kubeletVersion": "v1.28.0"')

      // Should be valid JSON
      const parsedJson = JSON.parse(result)
      expect(parsedJson.kind).toBe('List')
      expect(parsedJson.items).toHaveLength(2)
      expect(parsedJson.items[0].metadata.name).toBe('control-plane')
      expect(parsedJson.items[1].metadata.name).toBe('worker-node-1')
    })
  })

  describe('YAML format', () => {
    it('should return nodes in YAML format', () => {
      const state = createState()
      const parsed = createParsedCommand({
        flags: { output: 'yaml' }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('apiVersion: v1')
      expect(result).toContain('kind: List')
      expect(result).toContain('items:')
      expect(result).toContain('control-plane')
      expect(result).toContain('worker-node-1')
      expect(result).toContain('kubeletVersion: v1.35.0')
      expect(result).toContain('kubeletVersion: v1.28.0')
    })
  })

  describe('cluster-scoped behavior', () => {
    it('should ignore namespace flag for nodes', () => {
      const state = createState()
      const parsed = createParsedCommand({
        namespace: 'default' // Should be ignored for nodes
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      // Should still return all nodes regardless of namespace
      expect(result).toContain('control-plane')
      expect(result).toContain('worker-node-1')
    })

    it('should render resource references with output name', () => {
      const state = createState()
      const parsed = createParsedCommand({
        flags: { output: 'name' }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)
      const lines = result.split('\n')

      expect(lines).toContain('node/control-plane')
      expect(lines).toContain('node/worker-node-1')
    })
  })

  describe('label selector', () => {
    it('should filter nodes by label selector', () => {
      const state = createState()
      const parsed = createParsedCommand({
        selector: { 'node-role.kubernetes.io/control-plane': '' }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('control-plane')
      expect(result).not.toContain('worker-node-1')
    })

    it('should filter nodes by worker label', () => {
      const state = createState()
      const parsed = createParsedCommand({
        selector: { 'node-role.kubernetes.io/worker': '' }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('worker-node-1')
      expect(result).not.toContain('control-plane')
    })

    it('should filter nodes with set-based in selector', () => {
      const state = createState()
      const parsed = createParsedCommand({
        selector: {
          requirements: [
            {
              key: 'node-role.kubernetes.io/worker',
              operator: 'In',
              values: ['']
            }
          ]
        }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('worker-node-1')
      expect(result).not.toContain('control-plane')
    })

    it('should filter nodes with does-not-exist selector', () => {
      const state = createState()
      const parsed = createParsedCommand({
        selector: {
          requirements: [
            {
              key: 'node-role.kubernetes.io/worker',
              operator: 'DoesNotExist',
              values: []
            }
          ]
        }
      })

      apiServer.etcd.restore(state)
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('control-plane')
      expect(result).not.toContain('worker-node-1')
    })
  })
})

describe('kubectl get handler - endpoints', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => {
    return {
      action: 'get',
      resource: 'endpoints',
      flags: {},
      ...overrides
    }
  }

  it('should list endpoints in table format', () => {
    const webEndpoints = createEndpoints({
      name: 'web-svc',
      namespace: 'default',
      subsets: [
        {
          addresses: [{ ip: '10.244.0.10' }],
          ports: [{ port: 8080, protocol: 'TCP' }]
        }
      ],
      creationTimestamp: '2024-01-16T18:03:00Z'
    })
    const state = createClusterStateData({ endpoints: [webEndpoints] })
    apiServer.etcd.restore(state)

    const result = handleGet(apiServer, createParsedCommand())

    expect(result).toContain('NAME')
    expect(result).toContain('ENDPOINTS')
    expect(result).toContain('web-svc')
    expect(result).toContain('10.244.0.10:8080')
  })

  it('should return endpoints in json format', () => {
    const emptyEndpoints = createEndpoints({
      name: 'web-svc',
      namespace: 'default',
      subsets: undefined
    })
    const state = createClusterStateData({ endpoints: [emptyEndpoints] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({ flags: { output: 'json' } })
    )

    expect(result).toContain('"apiVersion": "v1"')
    expect(result).toContain('"kind": "List"')
    expect(result).toContain('"name": "web-svc"')
    const payload = JSON.parse(result)
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].kind).toBe('Endpoints')
  })
})

describe('kubectl get handler - endpointslices', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => {
    return {
      action: 'get',
      resource: 'endpointslices',
      flags: {},
      ...overrides
    }
  }

  it('should list endpointslices in table format', () => {
    const endpointSlice = createServiceEndpointSlice({
      serviceName: 'web-svc',
      namespace: 'default',
      backends: [
        {
          podName: 'web-prod',
          namespace: 'default',
          podIP: '10.244.0.10',
          targetPort: 8080
        }
      ],
      creationTimestamp: '2024-01-16T18:03:00Z'
    })
    const state = createClusterStateData({ endpointSlices: [endpointSlice] })
    apiServer.etcd.restore(state)

    const result = handleGet(apiServer, createParsedCommand())

    expect(result).toContain('NAME')
    expect(result).toContain('ADDRESS-TYPE')
    expect(result).toContain('PORTS')
    expect(result).toContain('ENDPOINTS')
    expect(result).toContain('web-svc-')
    expect(result).toContain('IPv4')
    expect(result).toContain('8080')
    expect(result).toContain('10.244.0.10')
  })

  it('should return endpointslices in json format', () => {
    const endpointSlice = createServiceEndpointSlice({
      serviceName: 'web-svc',
      namespace: 'default',
      backends: []
    })
    const state = createClusterStateData({ endpointSlices: [endpointSlice] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({ flags: { output: 'json' } })
    )

    expect(result).toContain('"apiVersion": "discovery.k8s.io/v1"')
    expect(result).toContain('"kind": "List"')
    const payload = JSON.parse(result)
    expect(payload.items).toHaveLength(1)
    expect(payload.items[0].metadata.name).toMatch(/^web-svc-[a-z0-9]{5}$/)
    expect(payload.items[0].kind).toBe('EndpointSlice')
  })
})

describe('kubectl get handler - events', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => {
    return {
      action: 'get',
      resource: 'events',
      flags: {},
      ...overrides
    }
  }

  it('should list events in table format', () => {
    const normalEvent = createEvent({
      name: 'api-created.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'api-created',
        namespace: 'default'
      },
      reason: 'PodCreated',
      message: 'PodCreated pod/api-created',
      lastTimestamp: '2026-04-06T10:00:00Z'
    })
    const warningEvent = createEvent({
      name: 'worker-failed.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'worker-failed',
        namespace: 'default'
      },
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      type: 'Warning',
      lastTimestamp: '2026-04-06T09:59:00Z'
    })
    const state = createClusterStateData({ events: [warningEvent, normalEvent] })
    apiServer.etcd.restore(state)

    const result = handleGet(apiServer, createParsedCommand())

    expect(result).toContain('LAST SEEN')
    expect(result).toContain('TYPE')
    expect(result).toContain('REASON')
    expect(result).toContain('OBJECT')
    expect(result).toContain('MESSAGE')
    expect(result).toContain('Normal')
    expect(result).toContain('Warning')
    expect(result).toContain('pod/api-created')
    expect(result).toContain('PodCreated pod/api-created')
    expect(result.indexOf('pod/api-created')).toBeLessThan(
      result.indexOf('pod/worker-failed')
    )
  })

  it('should include namespace column with all namespaces flag', () => {
    const defaultEvent = createEvent({
      name: 'default-e.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'default-e',
        namespace: 'default'
      },
      reason: 'Scheduled',
      message: 'Successfully assigned default/default-e'
    })
    const kubeSystemEvent = createEvent({
      name: 'kube-system-e.1',
      namespace: 'kube-system',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'kube-system-e',
        namespace: 'kube-system'
      },
      reason: 'Pulled',
      message: 'Container image already present'
    })
    const state = createClusterStateData({
      events: [defaultEvent, kubeSystemEvent]
    })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({ flags: { 'all-namespaces': true, A: true } })
    )

    expect(result).toContain('NAMESPACE')
    expect(result).toContain('default')
    expect(result).toContain('kube-system')
  })

  it('should filter events by involvedObject.name field selector', () => {
    const matchingEvent = createEvent({
      name: 'api-created.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'api-created',
        namespace: 'default'
      },
      reason: 'Started',
      message: 'Started container api'
    })
    const otherEvent = createEvent({
      name: 'worker-failed.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'worker-failed',
        namespace: 'default'
      },
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      type: 'Warning'
    })
    const state = createClusterStateData({ events: [matchingEvent, otherEvent] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({
        flags: { 'field-selector': 'involvedObject.name=api-created' }
      })
    )

    expect(result).toContain('pod/api-created')
    expect(result).not.toContain('pod/worker-failed')
  })

  it('should filter events across namespaces with -A and involvedObject.name', () => {
    const defaultEvent = createEvent({
      name: 'api-created.default.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'api-created',
        namespace: 'default'
      },
      reason: 'Started',
      message: 'Started container api'
    })
    const kubeSystemEvent = createEvent({
      name: 'api-created.kube-system.1',
      namespace: 'kube-system',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'api-created',
        namespace: 'kube-system'
      },
      reason: 'Started',
      message: 'Started container api in kube-system'
    })
    const otherEvent = createEvent({
      name: 'other-event.1',
      namespace: 'kube-system',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'other-pod',
        namespace: 'kube-system'
      },
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      type: 'Warning'
    })
    const state = createClusterStateData({
      events: [defaultEvent, kubeSystemEvent, otherEvent]
    })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({
        flags: {
          'all-namespaces': true,
          A: true,
          'field-selector': 'involvedObject.name=api-created'
        }
      })
    )

    expect(result).toContain('NAMESPACE')
    expect(result).toContain('default')
    expect(result).toContain('kube-system')
    expect(result).toContain('pod/api-created')
    expect(result).not.toContain('pod/other-pod')
  })

  it('should allow metadata.namespace selector with -A for events', () => {
    const defaultEvent = createEvent({
      name: 'default-event.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'default-pod',
        namespace: 'default'
      },
      reason: 'Started',
      message: 'Started default pod'
    })
    const kubeSystemEvent = createEvent({
      name: 'kube-system-event.1',
      namespace: 'kube-system',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'kube-system-pod',
        namespace: 'kube-system'
      },
      reason: 'Pulled',
      message: 'Successfully pulled image'
    })
    const state = createClusterStateData({ events: [defaultEvent, kubeSystemEvent] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({
        flags: {
          'all-namespaces': true,
          A: true,
          'field-selector': 'metadata.namespace=kube-system'
        }
      })
    )

    expect(result).toContain('kube-system')
    expect(result).toContain('pod/kube-system-pod')
    expect(result).not.toContain('pod/default-pod')
  })

  it('should filter events by reason field selector', () => {
    const startedEvent = createEvent({
      name: 'api-started.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'api-started',
        namespace: 'default'
      },
      reason: 'Started',
      message: 'Started container api'
    })
    const backoffEvent = createEvent({
      name: 'api-backoff.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'api-backoff',
        namespace: 'default'
      },
      reason: 'BackOff',
      message: 'Back-off restarting failed container',
      type: 'Warning'
    })
    const state = createClusterStateData({ events: [startedEvent, backoffEvent] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({ flags: { 'field-selector': 'reason=Started' } })
    )

    expect(result).toContain('pod/api-started')
    expect(result).not.toContain('pod/api-backoff')
  })
})

describe('kubectl get handler - pods field selectors', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => {
    return {
      action: 'get',
      resource: 'pods',
      flags: {},
      ...overrides
    }
  }

  it('should filter pods by status.phase field selector', () => {
    const runningPod = createPod({
      name: 'api-running',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    const pendingPod = createPod({
      name: 'api-pending',
      namespace: 'default',
      phase: 'Pending',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    const state = createClusterStateData({ pods: [runningPod, pendingPod] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({ flags: { 'field-selector': 'status.phase=Running' } })
    )

    expect(result).toContain('api-running')
    expect(result).not.toContain('api-pending')
  })

  it('should filter pods by spec.nodeName field selector', () => {
    const controlPlanePod = createPod({
      name: 'api-on-control-plane',
      namespace: 'default',
      phase: 'Running',
      nodeName: 'sim-control-plane',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    const workerPod = createPod({
      name: 'api-on-worker',
      namespace: 'default',
      phase: 'Running',
      nodeName: 'sim-worker',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    const state = createClusterStateData({ pods: [controlPlanePod, workerPod] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({
        flags: { 'field-selector': 'spec.nodeName=sim-worker' }
      })
    )

    expect(result).toContain('api-on-worker')
    expect(result).not.toContain('api-on-control-plane')
  })

  it('should filter pods by metadata.name field selector', () => {
    const targetPod = createPod({
      name: 'target-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    const otherPod = createPod({
      name: 'other-pod',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    const state = createClusterStateData({ pods: [targetPod, otherPod] })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({ flags: { 'field-selector': 'metadata.name=target-pod' } })
    )

    expect(result).toContain('target-pod')
    expect(result).not.toContain('other-pod')
  })

  it('should return kubectl-like bad request for unsupported field selector key', () => {
    const state = createClusterStateData({
      pods: [
        createPod({
          name: 'api-pod',
          namespace: 'default',
          phase: 'Running',
          containers: [{ name: 'api', image: 'nginx:1.28' }]
        })
      ]
    })
    apiServer.etcd.restore(state)

    const result = handleGet(
      apiServer,
      createParsedCommand({ flags: { 'field-selector': 'foo=bar' } })
    )

    expect(result).toContain('Error from server (BadRequest)')
    expect(result).toContain('field selector "foo=bar"')
    expect(result).toContain('field label not supported: foo')
  })
})
