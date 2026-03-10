import { describe, expect, it } from 'vitest'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

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

describe('kubectl get --show-labels', () => {
  it('adds LABELS column for pods default table output', () => {
    const state = createClusterStateData({
      pods: [
        createPod({
          name: 'web-a',
          namespace: 'default',
          labels: { app: 'web', tier: 'frontend' },
          containers: [{ name: 'nginx', image: 'nginx:1.28' }],
          phase: 'Running'
        })
      ]
    })
    const parsed = createParsedCommand({
      flags: { 'show-labels': true }
    })

    const result = handleGet(state, parsed)

    expect(result).toContain('LABELS')
    expect(result).toContain('app=web,tier=frontend')
  })

  it('adds LABELS column for pods all-namespaces wide output', () => {
    const state = createClusterStateData({
      pods: [
        createPod({
          name: 'web-a',
          namespace: 'default',
          labels: { app: 'web' },
          nodeName: 'sim-worker',
          containers: [{ name: 'nginx', image: 'nginx:1.28' }],
          phase: 'Running'
        }),
        createPod({
          name: 'dns-a',
          namespace: 'kube-system',
          labels: { app: 'dns', k8s: 'core' },
          nodeName: 'sim-control-plane',
          containers: [{ name: 'coredns', image: 'coredns:1.11' }],
          phase: 'Running'
        })
      ]
    })
    const parsed = createParsedCommand({
      flags: { 'show-labels': true, 'all-namespaces': true, output: 'wide' }
    })

    const result = handleGet(state, parsed)

    expect(result).toContain('LABELS')
    expect(result).toContain('app=web')
    expect(result).toContain('app=dns,k8s=core')
  })
})
