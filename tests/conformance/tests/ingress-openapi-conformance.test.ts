import { describe, expect, it } from 'vitest'
import { createClusterStateData } from '../../unit/helpers/utils'
import { handleGetRaw } from '../../../src/core/kubectl/commands/handlers/getRaw'

describe('Ingress OpenAPI Conformance', () => {
  it('should expose networking openapi index entry', () => {
    const state = createClusterStateData()
    const output = handleGetRaw(state, '/openapi/v3')
    const payload = JSON.parse(output) as {
      paths: Record<string, { serverRelativeURL: string }>
    }

    expect(payload.paths['apis/networking.k8s.io/v1']).toBeDefined()
    expect(payload.paths['apis/networking.k8s.io/v1'].serverRelativeURL).toBe(
      '/openapi/v3/apis/networking.k8s.io/v1'
    )
  })

  it('should expose ingress and ingressclass resources under networking api group', () => {
    const state = createClusterStateData()
    const output = handleGetRaw(state, '/apis/networking.k8s.io/v1')
    const payload = JSON.parse(output) as {
      kind: string
      resources: Array<{ name: string; kind: string }>
    }

    expect(payload.kind).toBe('APIResourceList')
    const names = payload.resources.map((resource) => resource.name)
    expect(names).toContain('ingresses')
    expect(names).toContain('ingressclasses')
  })
})
