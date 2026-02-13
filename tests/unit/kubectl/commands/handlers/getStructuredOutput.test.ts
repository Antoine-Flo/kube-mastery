import { describe, expect, it } from 'vitest'
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
      containers: [{ name: 'nginx', image: 'nginx:1.25' }],
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
    expect(result).not.toContain('kind: List')
  })

  it('returns Pod object JSON when querying by name', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.25' }],
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
  })
})
