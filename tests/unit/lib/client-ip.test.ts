import { describe, expect, it } from 'vitest'
import { getTrustedClientIp } from '../../../src/lib/client-ip'

describe('getTrustedClientIp', () => {
  it('prefers adapter clientAddress when available', () => {
    const request = new Request('https://example.test', {
      headers: { 'cf-connecting-ip': '203.0.113.10' }
    })

    const ip = getTrustedClientIp({
      request,
      clientAddress: '198.51.100.42'
    })

    expect(ip).toBe('198.51.100.42')
  })

  it('uses cf-connecting-ip when clientAddress is missing', () => {
    const request = new Request('https://example.test', {
      headers: { 'cf-connecting-ip': '203.0.113.10' }
    })

    const ip = getTrustedClientIp({ request })

    expect(ip).toBe('203.0.113.10')
  })

  it('falls back to true-client-ip when cf-connecting-ip is missing', () => {
    const request = new Request('https://example.test', {
      headers: { 'true-client-ip': '198.51.100.7' }
    })

    const ip = getTrustedClientIp({ request })

    expect(ip).toBe('198.51.100.7')
  })

  it('does not trust x-forwarded-for or x-real-ip directly', () => {
    const request = new Request('https://example.test', {
      headers: {
        'x-forwarded-for': '1.2.3.4',
        'x-real-ip': '5.6.7.8'
      }
    })

    const ip = getTrustedClientIp({ request })

    expect(ip).toBeNull()
  })
})
