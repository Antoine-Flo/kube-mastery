import { describe, expect, it } from 'vitest'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
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
  it('returns PodList YAML for empty collection', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: { output: 'yaml' }
    })

    const result = handleGet(state, parsed)

    expect(result).toContain('apiVersion: v1')
    expect(result).toContain('kind: List')
    expect(result).toContain('metadata:')
    expect(result).toContain('resourceVersion: ""')
    expect(result).toContain('items: []')
  })

  it('returns PodList JSON for empty collection', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetCommand({
      flags: { output: 'json' }
    })

    const result = handleGet(state, parsed)
    const parsedJson = JSON.parse(result)

    expect(parsedJson.apiVersion).toBe('v1')
    expect(parsedJson.kind).toBe('List')
    expect(parsedJson.metadata.resourceVersion).toBe('')
    expect(parsedJson.items).toEqual([])
    expect(result).toContain('\n    "apiVersion": "v1"')
    expect(result).toContain('\n        "resourceVersion": ""')
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

    const result = handleGet(state, parsed)

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

    const result = handleGet(state, parsed)
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

    const result = handleGet(state, parsed)

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

    const result = handleGet(state, parsed)

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

    const result = handleGet(state, parsed)

    expect(result).toContain('web')
    expect(result).toContain('api')
  })
})
