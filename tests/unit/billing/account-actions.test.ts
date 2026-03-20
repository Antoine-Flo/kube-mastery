import { describe, expect, it } from 'vitest'
import {
  addFlashParam,
  getSafeRedirectTarget
} from '../../../src/lib/billing/account-actions'

describe('getSafeRedirectTarget', () => {
  const fallback = '/en/profile'

  it('returns fallback when redirect is empty', () => {
    expect(getSafeRedirectTarget(null, fallback)).toBe(fallback)
  })

  it('keeps a local path and query string', () => {
    expect(getSafeRedirectTarget('/en/profile?tab=security', fallback)).toBe(
      '/en/profile?tab=security'
    )
  })

  it('rejects protocol-relative redirects', () => {
    expect(getSafeRedirectTarget('//evil.com', fallback)).toBe(fallback)
  })

  it('rejects backslash-based external redirect payloads', () => {
    const payload = String.raw`/\evil.com`
    expect(getSafeRedirectTarget(payload, fallback)).toBe(fallback)
  })

  it('rejects absolute external URLs', () => {
    expect(getSafeRedirectTarget('https://evil.com/path', fallback)).toBe(
      fallback
    )
  })
})

describe('addFlashParam', () => {
  it('appends flash param when query is empty', () => {
    expect(addFlashParam('/en/profile', 'account_error', 'delete_failed')).toBe(
      '/en/profile?account_error=delete_failed'
    )
  })

  it('preserves existing query params', () => {
    expect(
      addFlashParam(
        '/en/profile?tab=security',
        'account_error',
        'delete_failed'
      )
    ).toBe('/en/profile?tab=security&account_error=delete_failed')
  })
})
