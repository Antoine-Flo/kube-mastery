import { beforeEach, describe, expect, it, vi } from 'vitest'

const emitMock = vi.hoisted(() => {
  return vi.fn()
})

const getLoggerMock = vi.hoisted(() => {
  return vi.fn(() => {
    return {
      emit: emitMock
    }
  })
})

vi.mock('@opentelemetry/api-logs', () => {
  return {
    logs: {
      getLogger: getLoggerMock
    }
  }
})

import { emitOtelLog } from '../../../src/lib/observability/otel'

type OtelEmitPayload = {
  attributes: Record<string, string | number | boolean>
}

describe('otel sanitizeLogAttributes', () => {
  beforeEach(() => {
    emitMock.mockReset()
    getLoggerMock.mockClear()
  })

  it('redacts sensitive camelCase and key fields', () => {
    emitOtelLog({
      severityText: 'info',
      body: 'safety-check',
      attributes: {
        userEmail: 'alice@example.com',
        emailAddress: 'alice@company.test',
        ipAddress: '203.0.113.1',
        phoneNumber: '+33102030405',
        firstName: 'Alice',
        accessKey: 'AKIA-SECRET',
        stripeKey: 'sk_test_123',
        safeField: 'visible'
      }
    })

    const payload = emitMock.mock.calls[0][0] as OtelEmitPayload
    expect(payload.attributes.userEmail).toBe('[REDACTED]')
    expect(payload.attributes.emailAddress).toBe('[REDACTED]')
    expect(payload.attributes.ipAddress).toBe('[REDACTED]')
    expect(payload.attributes.phoneNumber).toBe('[REDACTED]')
    expect(payload.attributes.firstName).toBe('[REDACTED]')
    expect(payload.attributes.accessKey).toBe('[REDACTED]')
    expect(payload.attributes.stripeKey).toBe('[REDACTED]')
    expect(payload.attributes.safeField).toBe('visible')
  })

  it('keeps truncation for non-sensitive string attributes', () => {
    const longValue = 'a'.repeat(400)

    emitOtelLog({
      severityText: 'info',
      body: 'length-check',
      attributes: {
        details: longValue
      }
    })

    const payload = emitMock.mock.calls[0][0] as OtelEmitPayload
    expect(payload.attributes.details).toBe(`${'a'.repeat(300)}...`)
  })
})
