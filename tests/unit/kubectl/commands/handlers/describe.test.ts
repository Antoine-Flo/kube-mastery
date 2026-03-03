import { describe, expect, it } from 'vitest'
import { createClusterStateData } from '../../../helpers/utils'
import { createNode } from '../../../../../src/core/cluster/ressources/Node'
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
    const parsed = createParsedCommand()
    const result = handleDescribe(state, parsed)

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
    const parsed = createParsedCommand({ namespace: 'kube-system' })
    const result = handleDescribe(state, parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('Name:')
    expect(result.value).toContain('sim-control-plane')
  })

  it('should return not found for unknown node', () => {
    const state = createState()
    const parsed = createParsedCommand({ name: 'missing-node' })
    const result = handleDescribe(state, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('nodes "missing-node" not found')
    }
  })

  it('should return error when node name is missing', () => {
    const state = createState()
    const parsed = createParsedCommand({ name: undefined })
    const result = handleDescribe(state, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('must specify the name')
    }
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
    const result = handleDescribe(state, parsed)

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
    const result = handleDescribe(state, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'deployments.apps "missing-deploy" not found'
      )
    }
  })
})
