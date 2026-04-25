import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createServiceEndpointSlice } from '../../../../../src/core/cluster/ressources/EndpointSlice'
import { createEndpoints } from '../../../../../src/core/cluster/ressources/Endpoints'
import { createEvent } from '../../../../../src/core/cluster/ressources/Event'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

const createParsedGetCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'get',
    resource: 'pods',
    flags: {},
    ...overrides
  }
}

describe('kubectl get handler - structured output parity', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  it('returns PodList YAML for empty collection', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: { output: 'yaml' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('apiVersion: v1')
    expect(result).toContain('kind: List')
    expect(result).toContain('metadata:')
    expect(result).toContain('resourceVersion: "2"')
    expect(result).toContain('items: []')
  })

  it('returns PodList JSON for empty collection', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: { output: 'json' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)
    const parsedJson = JSON.parse(result)

    expect(parsedJson.apiVersion).toBe('v1')
    expect(parsedJson.kind).toBe('List')
    expect(parsedJson.metadata.resourceVersion).toBe('2')
    expect(parsedJson.items).toEqual([])
    expect(result).toContain('\n    "apiVersion": "v1"')
    expect(result).toContain('\n        "resourceVersion": "2"')
  })

  it('returns Pod object YAML when querying by name', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Running'
    })
    const state = createClusterStateData({ pods: [webPod] })
    const parsed = createParsedGetCommand({
      name: 'web',
      flags: { output: 'yaml' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('apiVersion: v1')
    expect(result).toContain('kind: Pod')
    expect(result).toContain('name: web')
    expect(result).toContain('uid:')
    expect(result).toContain('resourceVersion:')
    expect(result).toContain('schedulerName: default-scheduler')
    expect(result).toContain('qosClass:')
    expect(result).toContain('conditions:')
    expect(result).not.toContain('kind: List')
  })

  it('keeps pod template fields in YAML pod output', () => {
    const richPod = createPod({
      name: 'coredns-006512c628-12r8f',
      namespace: 'kube-system',
      labels: {
        'k8s-app': 'kube-dns',
        'pod-template-hash': '006512c628'
      },
      ownerReferences: [
        {
          apiVersion: 'apps/v1',
          kind: 'ReplicaSet',
          name: 'coredns-006512c628',
          uid: 'kube-system-coredns-006512c628',
          controller: true
        }
      ],
      nodeName: 'sim-control-plane',
      nodeSelector: {
        'kubernetes.io/os': 'linux'
      },
      dnsPolicy: 'Default',
      serviceAccount: 'coredns',
      serviceAccountName: 'coredns',
      priorityClassName: 'system-cluster-critical',
      tolerations: [
        {
          key: 'CriticalAddonsOnly',
          operator: 'Exists'
        }
      ],
      containers: [
        {
          name: 'coredns',
          image: 'registry.k8s.io/coredns/coredns:v1.13.1',
          imagePullPolicy: 'IfNotPresent',
          args: ['-conf', '/etc/coredns/Corefile'],
          ports: [
            {
              containerPort: 8080,
              name: 'liveness-probe',
              protocol: 'TCP'
            }
          ],
          livenessProbe: {
            type: 'httpGet',
            path: '/health',
            port: 'liveness-probe',
            initialDelaySeconds: 60,
            periodSeconds: 10,
            successThreshold: 1,
            timeoutSeconds: 5,
            failureThreshold: 5
          },
          resources: {
            requests: {
              cpu: '100m',
              memory: '70Mi'
            },
            limits: {
              memory: '170Mi'
            }
          },
          securityContext: {
            allowPrivilegeEscalation: false
          },
          volumeMounts: [
            {
              name: 'config-volume',
              mountPath: '/etc/coredns',
              readOnly: true
            }
          ]
        }
      ],
      volumes: [
        {
          name: 'config-volume',
          source: {
            type: 'configMap',
            name: 'coredns'
          }
        }
      ],
      phase: 'Running'
    })
    const state = createClusterStateData({ pods: [richPod] })
    const parsed = createParsedGetCommand({
      name: richPod.metadata.name,
      namespace: 'kube-system',
      flags: { output: 'yaml' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('generateName: coredns-006512c628-')
    expect(result).toContain('blockOwnerDeletion: true')
    expect(result).toContain('name: liveness-probe')
    expect(result).toContain('livenessProbe:')
    expect(result).toContain('serviceAccountName: coredns')
    expect(result).toContain('priorityClassName: system-cluster-critical')
    expect(result).toContain('priority: 2000000000')
    expect(result).toContain('dnsPolicy: Default')
    expect(result).toContain('nodeSelector:')
    expect(result).toContain('kubernetes.io/os: linux')
    expect(result).toContain('configMap:')
    expect(result).toContain('allocatedResources:')
    expect(result).toContain('uid: 65532')
  })

  it('returns Pod object JSON when querying by name', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Running'
    })
    const state = createClusterStateData({ pods: [webPod] })
    const parsed = createParsedGetCommand({
      name: 'web',
      flags: { output: 'json' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)
    const parsedJson = JSON.parse(result)

    expect(parsedJson.apiVersion).toBe('v1')
    expect(parsedJson.kind).toBe('Pod')
    expect(parsedJson.metadata.name).toBe('web')
    expect(parsedJson.metadata.uid).toBeDefined()
    expect(parsedJson.metadata.resourceVersion).toBeDefined()
    expect(parsedJson.spec.schedulerName).toBe('default-scheduler')
    expect(parsedJson.status.qosClass).toBeDefined()
    expect(Array.isArray(parsedJson.status.conditions)).toBe(true)
  })

  it('returns Deployment object YAML when querying by name', () => {
    const deployment = createDeployment({
      name: 'coredns',
      namespace: 'kube-system',
      replicas: 2,
      selector: {
        matchLabels: {
          'k8s-app': 'kube-dns'
        }
      },
      template: {
        metadata: {
          labels: {
            'k8s-app': 'kube-dns'
          }
        },
        spec: {
          containers: [
            {
              name: 'coredns',
              image: 'registry.k8s.io/coredns/coredns:v1.13.1'
            }
          ]
        }
      },
      annotations: {
        'sim.kubernetes.io/preferred-node': 'conformance-control-plane'
      }
    })
    const state = createClusterStateData({ deployments: [deployment] })
    const parsed = createParsedGetCommand({
      resource: 'deployments',
      name: 'coredns',
      namespace: 'kube-system',
      flags: { output: 'yaml' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('apiVersion: apps/v1')
    expect(result).toContain('kind: Deployment')
    expect(result).toContain('name: coredns')
    expect(result).toContain('uid:')
    expect(result).toContain('resourceVersion:')
    expect(result).toContain('observedGeneration:')
    expect(result).toContain('deployment.kubernetes.io/revision: "1"')
    expect(result).not.toContain('sim.kubernetes.io/preferred-node')
    expect(result).not.toContain('&a1')
  })

  it('returns ConfigMap object YAML with metadata parity fields', () => {
    const configMap = createConfigMap({
      name: 'web-config',
      namespace: 'default',
      creationTimestamp: '2026-04-04T17:41:29.771Z',
      data: {
        APP_ENV: 'crash-course',
        LOG_LEVEL: 'debug'
      }
    })
    const state = createClusterStateData({ configMaps: [configMap] })
    const parsed = createParsedGetCommand({
      resource: 'configmaps',
      name: 'web-config',
      flags: { output: 'yaml' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('kind: ConfigMap')
    expect(result).toContain('name: web-config')
    expect(result).toContain('resourceVersion:')
    expect(result).toContain('uid:')
    expect(result).toContain('creationTimestamp: "2026-04-04T17:41:29Z"')
  })

  it('returns Secret object YAML with metadata parity fields', () => {
    const secret = createSecret({
      name: 'web-secret',
      namespace: 'default',
      creationTimestamp: '2026-04-04T17:41:37.122Z',
      secretType: { type: 'Opaque' },
      data: {
        API_TOKEN: 'c3VwZXItc2VjcmV0LXRva2Vu'
      }
    })
    const state = createClusterStateData({ secrets: [secret] })
    const parsed = createParsedGetCommand({
      resource: 'secrets',
      name: 'web-secret',
      flags: { output: 'yaml' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('kind: Secret')
    expect(result).toContain('name: web-secret')
    expect(result).toContain('type: Opaque')
    expect(result).toContain('resourceVersion:')
    expect(result).toContain('uid:')
    expect(result).toContain('creationTimestamp: "2026-04-04T17:41:37Z"')
  })

  it('returns scalar value with jsonpath output', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Running'
    })
    const state = createClusterStateData({ pods: [webPod] })
    const parsed = createParsedGetCommand({
      name: 'web',
      flags: { output: "jsonpath='{.metadata.uid}'" }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result.length).toBeGreaterThan(10)
    expect(result).toContain('-')
  })

  it('returns joined values with jsonpath list extraction', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Running'
    })
    const apiPod = createPod({
      name: 'api',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Running'
    })
    const state = createClusterStateData({ pods: [webPod, apiPod] })
    const parsed = createParsedGetCommand({
      flags: { output: "jsonpath='{.items[*].metadata.name}'" }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('web')
    expect(result).toContain('api')
  })

  it('uses provided resourceVersion for structured list output', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: { output: 'json' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed, {
      getResourceVersion: () => '42'
    })
    const parsedJson = JSON.parse(result)

    expect(parsedJson.metadata.resourceVersion).toBe('42')
  })

  it('returns EndpointsList metadata for endpoints json output', () => {
    const webEndpoints = createEndpoints({
      name: 'web-svc',
      namespace: 'default',
      subsets: [
        {
          addresses: [{ ip: '10.244.0.10' }],
          ports: [{ port: 8080, protocol: 'TCP' }]
        }
      ]
    })
    const state = createClusterStateData({ endpoints: [webEndpoints] })
    const parsed = createParsedGetCommand({
      resource: 'endpoints',
      flags: { output: 'json' }
    })
    apiServer.etcd.restore(state)

    const result = handleGet(apiServer, parsed)
    const parsedJson = JSON.parse(result)

    expect(parsedJson.apiVersion).toBe('v1')
    expect(parsedJson.kind).toBe('List')
    expect(parsedJson.items).toHaveLength(1)
    expect(parsedJson.items[0].kind).toBe('Endpoints')
  })

  it('returns EndpointSliceList metadata for endpointslices json output', () => {
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
    const state = createClusterStateData({ endpointSlices: [endpointSlice] })
    const parsed = createParsedGetCommand({
      resource: 'endpointslices',
      flags: { output: 'json' }
    })
    apiServer.etcd.restore(state)

    const result = handleGet(apiServer, parsed)
    const parsedJson = JSON.parse(result)

    expect(parsedJson.apiVersion).toBe('discovery.k8s.io/v1')
    expect(parsedJson.kind).toBe('List')
    expect(parsedJson.items).toHaveLength(1)
    expect(parsedJson.items[0].kind).toBe('EndpointSlice')
  })

  it('returns EventList metadata for events json output', () => {
    const eventItem = createEvent({
      name: 'demo.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'demo',
        namespace: 'default'
      },
      reason: 'Scheduled',
      message: 'Successfully assigned default/demo'
    })
    const state = createClusterStateData({ events: [eventItem] })
    const parsed = createParsedGetCommand({
      resource: 'events',
      flags: { output: 'json' }
    })
    apiServer.etcd.restore(state)

    const result = handleGet(apiServer, parsed)
    const parsedJson = JSON.parse(result)

    expect(parsedJson.apiVersion).toBe('v1')
    expect(parsedJson.kind).toBe('List')
    expect(parsedJson.items).toHaveLength(1)
    expect(parsedJson.items[0].kind).toBe('Event')
  })
})

describe('kubectl get handler - custom-columns output', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  it('returns table with custom columns for pods', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }],
      phase: 'Running'
    })
    const state = createClusterStateData({ pods: [webPod] })
    const parsed = createParsedGetCommand({
      flags: {
        output: "custom-columns='NAME:.metadata.name,STATUS:.status.phase'"
      }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('NAME')
    expect(result).toContain('STATUS')
    expect(result).toContain('web')
    expect(result).toContain('Running')
  })

  it('errors when custom-columns has no spec', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: { output: 'custom-columns' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('error:')
    expect(result).toContain(
      'custom-columns format specified but no custom columns given'
    )
  })

  it('errors when custom-columns segment has no colon', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: { output: "custom-columns='NAME.metadata.name'" }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('error:')
    expect(result).toContain('expected <header>:<json-path-expr>')
  })

  it('returns no resources message for empty list with custom-columns', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: {
        output: "custom-columns='NAME:.metadata.name'"
      }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).not.toContain('NAME')
    expect(result).toMatch(/no resources found|No resources found/i)
  })
})
