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
})

