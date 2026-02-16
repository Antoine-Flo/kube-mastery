import { describe, expect, it } from 'vitest'
import { getDisabledLocaleRedirectPath } from '../../../src/i18n/locale-routing'

describe('getDisabledLocaleRedirectPath', () => {
  it('redirects disabled FR routes to EN while preserving path and query', () => {
    expect(getDisabledLocaleRedirectPath('/fr/courses', '?a=1')).toBe(
      '/en/courses?a=1'
    )
  })

  it('does not redirect enabled locale or non-locale routes', () => {
    expect(getDisabledLocaleRedirectPath('/en/courses', '')).toBeNull()
    expect(getDisabledLocaleRedirectPath('/docs/intro', '?lang=fr')).toBeNull()
  })
})
