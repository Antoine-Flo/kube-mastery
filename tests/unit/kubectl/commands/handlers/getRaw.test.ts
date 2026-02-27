import { describe, expect, it } from 'vitest'
import { createNamespace } from '../../../../../src/core/cluster/ressources/Namespace'
import { handleGetRaw } from '../../../../../src/core/kubectl/commands/handlers/getRaw'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl get raw handler', () => {
  it('returns discovery root for "/"', () => {
    const state = createClusterStateData()
    const output = handleGetRaw(state, '/')
    const payload = JSON.parse(output) as { paths?: string[] }

    expect(Array.isArray(payload.paths)).toBe(true)
    expect(payload.paths).toContain('/api')
    expect(payload.paths).toContain('/api/v1')
    expect(payload.paths).toContain('/apis')
    expect(payload.paths).toContain('/apis/apps')
    expect(payload.paths).toContain('/apis/apps/v1')
    expect(payload.paths).toContain('/apis/')
    expect(payload.paths).toContain('/openapi/v3')
    expect(payload.paths).toContain('/openapi/v3/')
    expect(payload.paths).toContain('/metrics/slis')
    expect(output.startsWith('{\n  "paths"')).toBe(true)
  })

  it('returns NamespaceList for "/api/v1/namespaces"', () => {
    const state = createClusterStateData({
      namespaces: [
        createNamespace({ name: 'default' }),
        createNamespace({ name: 'kube-system' }),
        createNamespace({ name: 'kube-public' }),
        createNamespace({ name: 'kube-node-lease' }),
        createNamespace({ name: 'local-path-storage' }),
        createNamespace({ name: 'app' })
      ]
    })
    const output = handleGetRaw(state, '/api/v1/namespaces')
    const payload = JSON.parse(output) as {
      kind: string
      apiVersion: string
      items: Array<{
        metadata: {
          name: string
          labels: { 'kubernetes.io/metadata.name': string }
        }
      }>
    }
    const names = payload.items.map((item) => item.metadata.name)

    expect(payload.kind).toBe('NamespaceList')
    expect(payload.apiVersion).toBe('v1')
    expect(output.includes('\n')).toBe(false)
    expect(names).toContain('default')
    expect(names).toContain('kube-system')
    expect(names).toContain('kube-public')
    expect(names).toContain('kube-node-lease')
    expect(names).toContain('local-path-storage')
    expect(names).toContain('app')
    const defaultNamespace = payload.items.find(
      (item) => item.metadata.name === 'default'
    )
    expect(defaultNamespace).toBeDefined()
    if (defaultNamespace) {
      expect(defaultNamespace.metadata.labels['kubernetes.io/metadata.name']).toBe(
        'default'
      )
    }
  })

  it('returns OpenAPI v3 index for "/openapi/v3"', () => {
    const state = createClusterStateData()
    const output = handleGetRaw(state, '/openapi/v3')
    const payload = JSON.parse(output) as {
      paths: Record<string, { serverRelativeURL: string }>
    }

    expect(payload.paths['apis/networking.k8s.io/v1']).toBeDefined()
    expect(payload.paths['apis/networking.k8s.io/v1'].serverRelativeURL).toContain(
      '/openapi/v3/apis/networking.k8s.io/v1'
    )
  })

  it('returns networking API resources for "/apis/networking.k8s.io/v1"', () => {
    const state = createClusterStateData()
    const output = handleGetRaw(state, '/apis/networking.k8s.io/v1')
    const payload = JSON.parse(output) as {
      kind: string
      resources: Array<{ name: string }>
    }

    expect(payload.kind).toBe('APIResourceList')
    expect(payload.resources.map((resource) => resource.name)).toContain('ingresses')
    expect(payload.resources.map((resource) => resource.name)).toContain(
      'ingressclasses'
    )
  })

  it('returns not found message for unknown raw endpoint', () => {
    const state = createClusterStateData()
    const output = handleGetRaw(state, '/api/v1/unknown')

    expect(output).toContain('Error from server (NotFound)')
  })
})
