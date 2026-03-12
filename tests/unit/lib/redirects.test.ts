import { describe, expect, it } from 'vitest'
import { getSafeLocalRedirectTarget } from '../../../src/lib/redirects'

describe('getSafeLocalRedirectTarget', () => {
  const fallback = '/en'

  it('returns fallback when value is missing', () => {
    expect(getSafeLocalRedirectTarget(null, fallback)).toBe(fallback)
  })

  it('returns fallback when value does not start with slash', () => {
    expect(getSafeLocalRedirectTarget('courses', fallback)).toBe(fallback)
  })

  it('keeps safe local paths with query string', () => {
    expect(getSafeLocalRedirectTarget('/en/profile?tab=billing', fallback)).toBe(
      '/en/profile?tab=billing'
    )
  })

  it('rejects protocol-relative redirects', () => {
    expect(getSafeLocalRedirectTarget('//evil.com/path', fallback)).toBe(fallback)
  })

  it('rejects backslash external redirects', () => {
    const payload = String.raw`/\evil.com/path`
    expect(getSafeLocalRedirectTarget(payload, fallback)).toBe(fallback)
  })
})
