import { describe, expect, it } from 'vitest'
import { evaluateDrillAssertion } from '../../../../../src/core/drills/validation/AssertionEngine'
import type { ValidationQueryPort } from '../../../../../src/core/drills/validation/ValidationQueryPort'

function createQueryPort(overrides?: Partial<ValidationQueryPort>): ValidationQueryPort {
  return {
    findClusterResource: () => ({
      ok: true,
      value: {
        metadata: { name: 'web', labels: { app: 'web' } },
        status: { readyReplicas: 1, replicas: 1 }
      }
    }),
    listClusterResources: () => [{ kind: 'Pod', metadata: { name: 'web' } }],
    readFile: () => ({ ok: true, value: 'hello world' }),
    ...overrides
  }
}

describe('evaluateDrillAssertion', () => {
  it('passes clusterResourceExists', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'clusterResourceExists',
        kind: 'Namespace',
        name: 'demo',
        onFail: 'missing'
      },
      createQueryPort()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.passed).toBe(true)
  })

  it('fails clusterResourceExists when resource missing', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'clusterResourceExists',
        kind: 'Namespace',
        name: 'demo',
        onFail: 'missing'
      },
      createQueryPort({
        findClusterResource: () => ({ ok: false, error: 'not found' })
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.passed) {
      return
    }
    expect(result.value.failure.code).toBe('resource_not_found')
  })

  it('passes clusterFieldEquals', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'clusterFieldEquals',
        kind: 'Pod',
        namespace: 'app',
        name: 'web',
        path: '{.metadata.name}',
        value: 'web',
        onFail: 'fail'
      },
      createQueryPort()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.passed).toBe(true)
  })

  it('fails clusterFieldsEqual when values mismatch', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'clusterFieldsEqual',
        kind: 'Deployment',
        namespace: 'app',
        name: 'web',
        leftPath: '{.status.readyReplicas}',
        rightPath: '{.status.replicas}',
        onFail: 'not ready'
      },
      createQueryPort({
        findClusterResource: () => ({
          ok: true,
          value: { status: { readyReplicas: 1, replicas: 2 } }
        })
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.passed) {
      return
    }
    expect(result.value.failure.code).toBe('field_mismatch')
  })

  it('passes clusterFieldContains', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'clusterFieldContains',
        kind: 'Pod',
        namespace: 'app',
        name: 'web',
        path: '{.metadata.name}',
        value: 'we',
        onFail: 'missing'
      },
      createQueryPort()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.passed).toBe(true)
  })

  it('fails clusterFieldNotEmpty for empty values', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'clusterFieldNotEmpty',
        kind: 'Pod',
        namespace: 'app',
        name: 'web',
        path: '{.metadata.labels.missing}',
        onFail: 'empty'
      },
      createQueryPort()
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.passed) {
      return
    }
    expect(result.value.failure.code).toBe('field_empty')
  })

  it('passes clusterListFieldContains', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'clusterListFieldContains',
        kind: 'Pod',
        namespace: 'app',
        path: '{.items[*].metadata.name}',
        value: 'web',
        onFail: 'missing'
      },
      createQueryPort()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.passed).toBe(true)
  })

  it('passes filesystemFileContains', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'filesystemFileContains',
        path: '/tmp/a.txt',
        value: 'hello',
        onFail: 'missing'
      },
      createQueryPort()
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.passed).toBe(true)
  })

  it('fails filesystemFileExists when missing', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'filesystemFileExists',
        path: '/tmp/missing.txt',
        onFail: 'missing'
      },
      createQueryPort({
        readFile: () => ({ ok: false, error: 'not found' })
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.passed) {
      return
    }
    expect(result.value.failure.code).toBe('filesystem_file_missing')
  })

  it('fails filesystemFileNotEmpty for blank content', () => {
    const result = evaluateDrillAssertion(
      {
        type: 'filesystemFileNotEmpty',
        path: '/tmp/empty.txt',
        onFail: 'empty'
      },
      createQueryPort({
        readFile: () => ({ ok: true, value: '   ' })
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok || result.value.passed) {
      return
    }
    expect(result.value.failure.code).toBe('filesystem_file_empty')
  })
})

