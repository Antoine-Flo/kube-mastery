import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createClusterStateData } from '../../../helpers/utils'
import { createServiceEndpointSlice } from '../../../../../src/core/cluster/ressources/EndpointSlice'
import { createEndpoints } from '../../../../../src/core/cluster/ressources/Endpoints'
import { createEvent } from '../../../../../src/core/cluster/ressources/Event'
import { createNode } from '../../../../../src/core/cluster/ressources/Node'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createReplicaSet } from '../../../../../src/core/cluster/ressources/ReplicaSet'
import { createGateway } from '../../../../../src/core/cluster/ressources/Gateway'
import { createGatewayClass } from '../../../../../src/core/cluster/ressources/GatewayClass'
import { createHTTPRoute } from '../../../../../src/core/cluster/ressources/HTTPRoute'
import { createService } from '../../../../../src/core/cluster/ressources/Service'
import { handleDescribe } from '../../../../../src/core/kubectl/commands/handlers/describe'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createState = () => {
  const controlPlaneNode = createNode({
    name: 'sim-control-plane',
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
          address: 'sim-control-plane'
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

  return createClusterStateData({
    nodes: [controlPlaneNode]
  })
}

const createParsedCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'describe',
    resource: 'nodes',
    name: 'sim-control-plane',
    flags: {},
    ...overrides
  }
}

describe('kubectl describe handler - nodes', () => {
  it('should describe an existing node', () => {
    const state = createState()
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const parsed = createParsedCommand()
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('Name:')
    expect(result.value).toContain('sim-control-plane')
    expect(result.value).toContain('Roles:')
  })

  it('should ignore namespace filter for nodes (cluster-scoped)', () => {
    const state = createState()
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const parsed = createParsedCommand({ namespace: 'kube-system' })
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('Name:')
    expect(result.value).toContain('sim-control-plane')
  })

  it('should return not found for unknown node', () => {
    const state = createState()
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const parsed = createParsedCommand({ name: 'missing-node' })
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('nodes "missing-node" not found')
    }
  })

  it('should describe all nodes when node name is missing', () => {
    const state = createState()
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const parsed = createParsedCommand({ name: undefined })
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:')
    expect(result.value).toContain('sim-control-plane')
  })

  it('should describe all nodes when node name and selector are missing', () => {
    const state = createState()
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const parsed = createParsedCommand({ name: undefined, selector: undefined })
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:')
    expect(result.value).toContain('sim-control-plane')
  })
})

describe('kubectl describe handler - events', () => {
  it('should return no resources found when no event exists', () => {
    const state = createClusterStateData()
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'events',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe('No resources found in default namespace.')
  })

  it('should describe an existing event by name', () => {
    const state = createClusterStateData({
      events: [
        createEvent({
          name: 'pod-started.12345',
          namespace: 'default',
          involvedObject: {
            apiVersion: 'v1',
            kind: 'Pod',
            name: 'nginx-pod',
            namespace: 'default'
          },
          reason: 'Started',
          message: 'Started container nginx',
          type: 'Normal',
          count: 1,
          firstTimestamp: '2026-04-06T09:00:00.000Z',
          lastTimestamp: '2026-04-06T09:00:00.000Z'
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'events',
      name: 'pod-started.12345',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:             pod-started.12345')
    expect(result.value).toContain('API Version:      v1')
    expect(result.value).toContain('Kind:            Event')
    expect(result.value).toContain('Reason:                Started')
    expect(result.value).toContain('Message:         Started container nginx')
    expect(result.value).toContain('Involved Object:')
    expect(result.value).toContain('  Kind:          Pod')
    expect(result.value).toContain('  Name:          nginx-pod')
    expect(result.value).toContain('First Timestamp:  2026-04-06T09:00:00Z')
    expect(result.value).toContain('Last Timestamp:  2026-04-06T09:00:00Z')
    expect(result.value).toContain('Events:  <none>')
  })
})

describe('kubectl describe handler - selector support', () => {
  it('should require a name or selector for non-node resources', () => {
    const state = createClusterStateData({
      pods: [
        createPod({
          name: 'pod-a',
          namespace: 'default',
          containers: [{ name: 'web', image: 'nginx:1.28' }]
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'pods',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('must specify the name')
    }
  })

  it('should describe all pods matching selector with stable ordering', () => {
    const state = createClusterStateData({
      pods: [
        createPod({
          name: 'probed-b',
          namespace: 'default',
          labels: { app: 'probed' },
          containers: [{ name: 'web', image: 'nginx:1.28' }]
        }),
        createPod({
          name: 'probed-a',
          namespace: 'default',
          labels: { app: 'probed' },
          containers: [{ name: 'web', image: 'nginx:1.28' }]
        }),
        createPod({
          name: 'other',
          namespace: 'default',
          labels: { app: 'other' },
          containers: [{ name: 'web', image: 'nginx:1.28' }]
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'pods',
      namespace: 'default',
      selector: {
        requirements: [{ key: 'app', operator: 'Equals', values: ['probed'] }]
      },
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toMatch(/Name:\s+probed-a/)
    expect(result.value).toMatch(/Name:\s+probed-b/)
    expect(result.value).toContain('\n\n')
    expect(result.value.indexOf('probed-a')).toBeLessThan(
      result.value.indexOf('probed-b')
    )
    expect(result.value).not.toMatch(/Name:\s+other/)
  })

  it('should return no resources found when selector has no matches', () => {
    const state = createClusterStateData({
      pods: [
        createPod({
          name: 'other',
          namespace: 'default',
          labels: { app: 'other' },
          containers: [{ name: 'web', image: 'nginx:1.28' }]
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'pods',
      namespace: 'default',
      selector: {
        requirements: [{ key: 'app', operator: 'Equals', values: ['probed'] }]
      },
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe('No resources found in default namespace.')
  })
})

describe('kubectl describe handler - services and error semantics', () => {
  it('should describe an existing service', () => {
    const state = createClusterStateData({
      services: [
        createService({
          name: 'web-svc',
          namespace: 'default',
          clusterIP: '10.96.0.10',
          selector: { app: 'web' },
          ports: [{ port: 80, protocol: 'TCP', targetPort: 8080 }]
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'services',
      name: 'web-svc',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:')
    expect(result.value).toContain('web-svc')
    expect(result.value).toContain('Selector:')
    expect(result.value).toContain('app=web')
  })

  it('should use deployments.apps in deployment not found message', () => {
    const state = createClusterStateData()
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'deployments',
      name: 'missing-deploy',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'deployments.apps "missing-deploy" not found'
      )
    }
  })

  it('should read Endpoints line from endpoints resource', () => {
    const state = createClusterStateData({
      services: [
        createService({
          name: 'web-svc',
          namespace: 'default',
          clusterIP: '10.96.0.10',
          selector: { app: 'web' },
          ports: [{ port: 80, protocol: 'TCP', targetPort: 8080 }]
        })
      ],
      endpoints: [
        createEndpoints({
          name: 'web-svc',
          namespace: 'default',
          subsets: [
            {
              addresses: [{ ip: '10.244.0.10' }],
              ports: [{ port: 8080, protocol: 'TCP' }]
            }
          ]
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'services',
      name: 'web-svc',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Endpoints:                10.244.0.10:8080')
  })
})

describe('kubectl describe handler - replicasets', () => {
  it('should describe an existing replicaset', () => {
    const state = createClusterStateData({
      replicaSets: [
        createReplicaSet({
          name: 'web-rs',
          namespace: 'default',
          replicas: 3,
          selector: {
            matchLabels: { app: 'web' }
          },
          template: {
            metadata: {
              labels: { app: 'web' }
            },
            spec: {
              containers: [{ name: 'nginx', image: 'nginx:1.28' }]
            }
          },
          labels: { app: 'web' }
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'replicasets',
      name: 'web-rs',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:         web-rs')
    expect(result.value).toContain('Namespace:    default')
    expect(result.value).toContain('Selector:     app=web')
    expect(result.value).toContain('Replicas:     0 current / 3 desired')
    expect(result.value).toContain(
      'Pods Status:  0 Running / 0 Waiting / 0 Succeeded / 0 Failed'
    )
    expect(result.value).toContain('Events:            <none>')
  })

  it('should use replicasets.apps in not found message', () => {
    const state = createClusterStateData()
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'replicasets',
      name: 'missing-rs',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('replicasets.apps "missing-rs" not found')
    }
  })

  it('should render kind like events from managed pods', () => {
    const state = createClusterStateData({
      replicaSets: [
        createReplicaSet({
          name: 'web-rs',
          namespace: 'default',
          replicas: 2,
          selector: {
            matchLabels: { app: 'web' }
          },
          template: {
            metadata: {
              labels: { app: 'web' }
            },
            spec: {
              containers: [{ name: 'web', image: 'nginx:1.28' }]
            }
          }
        })
      ],
      pods: [
        createPod({
          name: 'web-rs-a1b2c',
          namespace: 'default',
          phase: 'Running',
          creationTimestamp: '2026-03-25T09:00:00.000Z',
          containers: [{ name: 'web', image: 'nginx:1.28' }],
          labels: { app: 'web' }
        }),
        createPod({
          name: 'web-rs-d3e4f',
          namespace: 'default',
          phase: 'Running',
          creationTimestamp: '2026-03-25T09:00:05.000Z',
          containers: [{ name: 'web', image: 'nginx:1.28' }],
          labels: { app: 'web' }
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'replicasets',
      name: 'web-rs',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Replicas:     2 current / 2 desired')
    expect(result.value).toContain(
      'Pods Status:  2 Running / 0 Waiting / 0 Succeeded / 0 Failed'
    )
    expect(result.value).toContain('Normal  SuccessfulCreate')
    expect(result.value).toContain('Created pod: web-rs-a1b2c')
    expect(result.value).toContain('Created pod: web-rs-d3e4f')
  })
})

describe('kubectl describe handler - endpoints', () => {
  it('should describe an existing endpoints resource', () => {
    const state = createClusterStateData({
      endpoints: [
        createEndpoints({
          name: 'web-svc',
          namespace: 'default',
          subsets: [
            {
              addresses: [{ ip: '10.244.0.10' }],
              ports: [{ port: 8080, protocol: 'TCP' }]
            }
          ]
        })
      ]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'endpoints',
      name: 'web-svc',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:         web-svc')
    expect(result.value).toContain('Subsets:      10.244.0.10:8080')
  })
})

describe('kubectl describe handler - endpointslices', () => {
  it('should describe an existing endpointslice resource', () => {
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
      ]
    })
    const state = createClusterStateData({
      endpointSlices: [endpointSlice]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'endpointslices',
      name: endpointSlice.metadata.name,
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain(
      `Name:         ${endpointSlice.metadata.name}`
    )
    expect(result.value).toContain('AddressType:  IPv4')
    expect(result.value).toContain('Ports:        8080/TCP')
    expect(result.value).toContain('Endpoints:    10.244.0.10')
  })
})

describe('kubectl describe handler - pods with event store', () => {
  it('uses injected pod lifecycle events when provided', () => {
    const pod = createPod({
      name: 'api-pod',
      namespace: 'default',
      nodeName: 'worker-a',
      containers: [{ name: 'api', image: 'nginx:latest' }],
      phase: 'Running'
    })
    const state = createClusterStateData({
      pods: [pod]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'pods',
      name: 'api-pod',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const result = handleDescribe(apiServer, parsed, {
      listPodEvents: () => {
        return [
          {
            type: 'Normal',
            reason: 'Scheduled',
            source: 'default-scheduler',
            message: 'Successfully assigned default/api-pod to worker-a',
            timestamp: '2026-03-13T10:00:00.000Z'
          },
          {
            type: 'Warning',
            reason: 'BackOff',
            source: 'kubelet',
            message:
              'Back-off restarting failed container api in pod default/api-pod',
            timestamp: '2026-03-13T10:00:05.000Z'
          }
        ]
      }
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Events:')
    expect(result.value).toContain('Successfully assigned default/api-pod')
    expect(result.value).toContain(
      'Back-off restarting failed container api in pod default/api-pod'
    )
  })

  it('prints Terminating status when deletion metadata is present', () => {
    const pod = createPod({
      name: 'api-pod',
      namespace: 'default',
      nodeName: 'worker-a',
      deletionTimestamp: '2026-03-19T12:00:00.000Z',
      containers: [{ name: 'api', image: 'nginx:latest' }],
      phase: 'Running'
    })
    const state = createClusterStateData({
      pods: [pod]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'pods',
      name: 'api-pod',
      namespace: 'default',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)
    const result = handleDescribe(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toMatch(/Status:\s+Terminating/)
  })
})

describe('kubectl describe handler - gateway api envoy', () => {
  it('should describe gatewayclass eg with kind like sections', () => {
    const gatewayClass = createGatewayClass({
      name: 'eg',
      spec: {
        controllerName: 'gateway.envoyproxy.io/gatewayclass-controller'
      },
      status: {
        conditions: [{ type: 'Accepted', status: 'True' }]
      }
    })
    const state = createClusterStateData({
      gatewayClasses: [gatewayClass]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'gatewayclasses',
      name: 'eg',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:         eg')
    expect(result.value).toContain('API Version:  gateway.networking.k8s.io/v1')
    expect(result.value).toContain('Kind:         GatewayClass')
    expect(result.value).toContain(
      'Controller:   gateway.envoyproxy.io/gatewayclass-controller'
    )
    expect(result.value).toContain('Accepted:     True')
  })

  it('should return not found when gatewayclass does not exist', () => {
    const state = createClusterStateData()
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'gatewayclasses',
      name: 'eg',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'gatewayclasses.gateway.networking.k8s.io "eg" not found'
      )
    }
  })

  it('should describe httproute backend with status conditions', () => {
    const httpRoute = createHTTPRoute({
      name: 'backend',
      namespace: 'default',
      spec: {
        hostnames: ['backend.example.com'],
        parentRefs: [{ name: 'eg' }]
      }
    })
    const state = createClusterStateData({
      httpRoutes: [httpRoute]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'httproutes',
      name: 'backend',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:         backend')
    expect(result.value).toContain('API Version:  gateway.networking.k8s.io/v1')
    expect(result.value).toContain('Kind:         HTTPRoute')
    expect(result.value).toContain('Hostnames:    backend.example.com')
    expect(result.value).toContain('Parent Refs:  default/eg')
  })

  it('should mark httproute backend refs as resolved when service exists', () => {
    const gateway = createGateway({
      name: 'eg',
      namespace: 'default',
      spec: {
        gatewayClassName: 'eg'
      }
    })
    const httpRoute = createHTTPRoute({
      name: 'backend',
      namespace: 'default',
      spec: {
        hostnames: ['backend.example.com'],
        parentRefs: [{ name: 'eg' }]
      }
    })
    const backendService = createService({
      name: 'backend',
      namespace: 'default',
      clusterIP: '10.96.0.20',
      ports: [{ port: 3000, protocol: 'TCP', targetPort: 3000 }]
    })
    const state = createClusterStateData({
      gateways: [gateway],
      httpRoutes: [httpRoute],
      services: [backendService]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'httproutes',
      name: 'backend',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:         backend')
    expect(result.value).toContain('Parent Refs:  default/eg')
  })

  it('should describe gateway eg with status and listener sections', () => {
    const gateway = createGateway({
      name: 'eg',
      namespace: 'default',
      spec: {
        gatewayClassName: 'eg'
      },
      status: {
        addresses: [{ value: '127.0.0.1' }],
        conditions: [
          { type: 'Programmed', status: 'False', reason: 'AddressNotAssigned' }
        ]
      }
    })
    const state = createClusterStateData({
      gateways: [gateway]
    })
    const parsed: ParsedCommand = {
      action: 'describe',
      resource: 'gateways',
      name: 'eg',
      flags: {}
    }
    const apiServer = createApiServerFacade()
    apiServer.etcd.restore(state)

    const result = handleDescribe(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:         eg')
    expect(result.value).toContain('API Version:  gateway.networking.k8s.io/v1')
    expect(result.value).toContain('Kind:         Gateway')
    expect(result.value).toContain('Gateway Class: eg')
    expect(result.value).toContain('Addresses:    127.0.0.1')
    expect(result.value).toContain('Programmed:   False')
  })
})
