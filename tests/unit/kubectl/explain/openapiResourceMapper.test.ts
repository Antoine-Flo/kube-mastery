import { describe, expect, it } from 'vitest'
import { mapResourceToOpenAPITarget } from '../../../../src/core/kubectl/explain/openapiResourceMapper'

describe('openapiResourceMapper', () => {
  it('maps core resource to core schema and spec', () => {
    const result = mapResourceToOpenAPITarget('pods')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.kind).toBe('Pod')
    expect(result.value.group).toBe('')
    expect(result.value.version).toBe('v1')
    expect(result.value.schemaName).toBe('io.k8s.api.core.v1.Pod')
    expect(result.value.specFile).toBe('api__v1_openapi.json')
  })

  it('maps apps apiVersion override to apps spec file', () => {
    const result = mapResourceToOpenAPITarget('deployments', 'apps/v1')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.group).toBe('apps')
    expect(result.value.version).toBe('v1')
    expect(result.value.schemaName).toBe('io.k8s.api.apps.v1.Deployment')
    expect(result.value.specFile).toBe('apis__apps__v1_openapi.json')
  })

  it('maps coordination apiVersion override to coordination schema', () => {
    const result = mapResourceToOpenAPITarget('leases', 'coordination.k8s.io/v1')
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.group).toBe('coordination.k8s.io')
    expect(result.value.schemaName).toBe('io.k8s.api.coordination.v1.Lease')
    expect(result.value.specFile).toBe('apis__coordination.k8s.io__v1_openapi.json')
  })

  it('returns unsupported resource error', () => {
    const result = mapResourceToOpenAPITarget('all')
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('does not have a resource type')
  })

  it('returns invalid api version when chunks are malformed', () => {
    const malformed = mapResourceToOpenAPITarget('pods', 'apps')
    expect(malformed.ok).toBe(false)
    if (malformed.ok) {
      return
    }
    expect(malformed.error).toContain('invalid api version')

    const missingVersion = mapResourceToOpenAPITarget('pods', 'v1/')
    expect(missingVersion.ok).toBe(false)
    if (missingVersion.ok) {
      return
    }
    expect(missingVersion.error).toContain('invalid api version')
  })

  it('returns unsupported api-version for unknown groups', () => {
    const result = mapResourceToOpenAPITarget('pods', 'batch/v1')
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('is not supported in this simulator')
  })
})
