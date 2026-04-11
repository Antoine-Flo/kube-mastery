import { describe, expect, it } from 'vitest'
import { DrillValidationService } from '../../../../../src/core/drills/validation/DrillValidationService'
import type { ValidationQueryPort } from '../../../../../src/core/drills/validation/ValidationQueryPort'

function createPassQueryPort(): ValidationQueryPort {
  return {
    findClusterResource: () => ({
      ok: true,
      value: { metadata: { name: 'web' } }
    }),
    listClusterResources: () => [{ metadata: { name: 'web' } }],
    readFile: () => ({ ok: true, value: 'content' })
  }
}

describe('DrillValidationService', () => {
  it('returns allPassed when assertions pass', async () => {
    const service = new DrillValidationService(createPassQueryPort(), {
      retryTimeoutMs: 0
    })
    const result = await service.run([
      {
        index: 1,
        assertions: [
          {
            type: 'clusterResourceExists',
            kind: 'Pod',
            namespace: 'app',
            name: 'web',
            onFail: 'missing'
          }
        ]
      }
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.allPassed).toBe(true)
    expect(result.value.tasks[0]).toMatchObject({ index: 1, passed: true })
  })

  it('returns task failure message when assertion fails', async () => {
    const service = new DrillValidationService(
      {
        ...createPassQueryPort(),
        findClusterResource: () => ({ ok: false, error: 'not found' })
      },
      { retryTimeoutMs: 0 }
    )
    const result = await service.run([
      {
        index: 3,
        assertions: [
          {
            type: 'clusterResourceExists',
            kind: 'Pod',
            namespace: 'app',
            name: 'web',
            onFail: 'pod missing'
          }
        ]
      }
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.allPassed).toBe(false)
    expect(result.value.tasks[0]).toMatchObject({
      index: 3,
      passed: false,
      errorMessage: 'pod missing'
    })
  })
})

