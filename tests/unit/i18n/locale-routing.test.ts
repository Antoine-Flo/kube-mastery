import { describe, expect, it } from 'vitest'
import { getDisabledLocaleRedirectPath } from '../../../src/i18n/locale-routing'

describe('getDisabledLocaleRedirectPath', () => {
  it('redirects disabled FR routes to EN while preserving path and query', () => {
    expect(getDisabledLocaleRedirectPath('/fr/courses', '?a=1')).toBe(
      '/en/courses?a=1'
    )
  })

  it('redirects invalid first segment to default lang', () => {
    expect(getDisabledLocaleRedirectPath('/docs/intro', '?lang=fr')).toBe(
      '/en/intro?lang=fr'
    )
    expect(
      getDisabledLocaleRedirectPath('/robots.txt/courses/common-core', '')
    ).toBe('/en/courses/common-core')
  })

  it('does not redirect enabled locale, API, or root static-like paths', () => {
    expect(getDisabledLocaleRedirectPath('/en/courses', '')).toBeNull()
    expect(getDisabledLocaleRedirectPath('/api/auth/callback', '')).toBeNull()
    expect(getDisabledLocaleRedirectPath('/robots.txt', '')).toBeNull()
  })

  it('does not redirect internal Astro and Vite dev paths', () => {
    expect(
      getDisabledLocaleRedirectPath(
        '/@id/astro/runtime/client/dev-toolbar/astro_runtime_client_dev-toolbar_entrypoint__js.js.map',
        ''
      )
    ).toBeNull()
    expect(
      getDisabledLocaleRedirectPath(
        '/astro/runtime/client/dev-toolbar/astro_runtime_client_dev-toolbar_entrypoint__js.js.map',
        ''
      )
    ).toBeNull()
    expect(
      getDisabledLocaleRedirectPath('/_astro/entry.C6LrgT3Y.js', '')
    ).toBeNull()
  })
})
