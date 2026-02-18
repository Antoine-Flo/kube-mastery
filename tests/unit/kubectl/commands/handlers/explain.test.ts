import { describe, expect, it } from 'vitest'
import { handleExplain } from '../../../../../src/core/kubectl/commands/handlers/explain'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createParsedExplain = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'explain',
    resource: 'pods',
    explainPath: [],
    flags: {},
    ...overrides
  }
}

describe('kubectl explain handler', () => {
  it('should render top-level explanation for all supported resources in v1 scope', () => {
    const resources: ParsedCommand['resource'][] = [
      'pods',
      'deployments',
      'services',
      'configmaps',
      'secrets',
      'namespaces',
      'nodes',
      'replicasets'
    ]

    for (const resource of resources) {
      const parsed = createParsedExplain({
        resource
      })
      const result = handleExplain(parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('KIND:')
        expect(result.value).toContain('VERSION:')
        expect(result.value).toContain('DESCRIPTION:')
      }
    }
  })

  it('should render top-level resource explanation', () => {
    const parsed = createParsedExplain()

    const result = handleExplain(parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('KIND:')
    expect(result.value).toContain('VERSION:')
    expect(result.value).toContain('DESCRIPTION:')
    expect(result.value).toContain('FIELDS:')
  })

  it('should render nested field explanation with OpenAPI-level details', () => {
    const parsed = createParsedExplain({
      explainPath: ['spec', 'containers']
    })

    const result = handleExplain(parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('FIELD:')
    expect(result.value).toContain('containers')
    expect(result.value).toContain('<[]Container>')
    expect(result.value).toContain('DESCRIPTION:')
    expect(result.value).toContain('List of containers belonging to the pod')
    expect(result.value).toContain('imagePullPolicy')
  })

  it('should return error when field path does not exist', () => {
    const parsed = createParsedExplain({
      explainPath: ['spec', 'unknown']
    })

    const result = handleExplain(parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('field "unknown" does not exist')
    }
  })

  it('should render nested fields recursively when --recursive flag is set', () => {
    const parsed = createParsedExplain({
      explainPath: ['spec', 'containers'],
      flags: { recursive: true }
    })

    const result = handleExplain(parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('FIELD:    containers')
    expect(result.value).toContain('name')
    expect(result.value).toContain('-required-')
    expect(result.value).toContain('ports')
    expect(result.value).toContain('containerPort')
  })

  it('should resolve deep deployment path from apps/v1 schema', () => {
    const parsed = createParsedExplain({
      resource: 'deployments',
      explainPath: ['spec', 'template', 'spec', 'containers']
    })

    const result = handleExplain(parsed)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('GROUP:')
    expect(result.value).toContain('apps')
    expect(result.value).toContain('KIND:')
    expect(result.value).toContain('Deployment')
    expect(result.value).toContain('FIELD:')
    expect(result.value).toContain('containers')
  })

  it('should return error when resource is not explainable', () => {
    const parsed = createParsedExplain({
      resource: 'all'
    })

    const result = handleExplain(parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('the server does not have a resource type')
    }
  })
})
