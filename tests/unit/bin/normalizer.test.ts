import { describe, expect, it } from 'vitest'
import { normalizeOutput } from '../../../bin/lib/normalizer'

describe('conformance normalizer', () => {
  it('should normalize timestamps and ids', () => {
    const input = [
      '2026-02-01T10:11:12.000Z',
      'uid: 123e4567-e89b-12d3-a456-426614174000',
      'resourceVersion: "12345"',
      'pod ip 10.244.1.15'
    ].join('\n')

    const normalized = normalizeOutput(input)
    expect(normalized).toContain('<timestamp>')
    expect(normalized).toContain('uid: <uid>')
    expect(normalized).toContain('resourceVersion: "<version>"')
    expect(normalized).toContain('<ip>')
  })
})
