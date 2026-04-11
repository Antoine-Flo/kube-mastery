import { describe, expect, it } from 'vitest'
import { emitOtelLog } from '../../../src/lib/api-log'

describe('api-log emitOtelLog', () => {
  it('stays a safe no-op', () => {
    expect(() => {
      emitOtelLog({
        severityText: 'info',
        body: 'safety-check',
        attributes: {
          userEmail: 'alice@example.com',
          safeField: 'visible'
        }
      })
    }).not.toThrow()
  })
})
