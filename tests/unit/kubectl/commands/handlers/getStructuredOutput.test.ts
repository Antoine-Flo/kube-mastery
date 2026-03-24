import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createServiceEndpointSlice } from '../../../../../src/core/cluster/ressources/EndpointSlice'
import { createEndpoints } from '../../../../../src/core/cluster/ressources/Endpoints'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
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
