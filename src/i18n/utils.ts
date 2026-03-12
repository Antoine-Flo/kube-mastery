import { ui, defaultLang, enabledLanguages } from './ui'

export type UiLang = keyof typeof ui

function isUiLanguage(value: string): value is UiLang {
  return value in ui
}

export function getLangFromUrl(url: URL): UiLang {
  const [, lang] = url.pathname.split('/')
  if (lang && isUiLanguage(lang) && isEnabledUiLang(lang)) {
    return lang
  }
  return defaultLang
}

export function getLangSegmentFromPath(pathname: string): UiLang | null {
  const [, lang] = pathname.split('/')
  if (lang && isUiLanguage(lang)) {
    return lang
  }
  return null
}

/** Path without locale prefix, for building same-page links in other locales (e.g. /fr/terms-of-service → /terms-of-service). */
export function getPathWithoutLocale(url: URL): string {
  const segments = url.pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return '/'
  }
  const first = segments[0]
  if (first in ui) {
    if (segments.length === 1) {
      return '/'
    }
    return '/' + segments.slice(1).join('/')
  }
  return url.pathname || '/'
}

export function useTranslations(lang: UiLang) {
  return function t(
    key: keyof (typeof ui)[typeof defaultLang],
    params?: Record<string, string | number>
  ) {
    const dict = lang && lang in ui ? ui[lang] : ui[defaultLang]
    let str = dict[key as string] ?? ui[defaultLang][key as string] ?? key
    if (params && typeof str === 'string') {
      str = str.replace(/\{(\w+)\}/g, (_, k) =>
        params[k] != null ? String(params[k]) : `{${k}}`
      )
    }
    return str
  }
}

export function useTranslatedPath(lang: UiLang) {
  return function translatePath(path: string, l: UiLang = lang): string {
    const effectiveLang = l ?? lang
    return path === '/' ? `/${effectiveLang}` : `/${effectiveLang}${path}`
  }
}

/** Path with locale prefix: /en for en, /fr for fr (single [lang] segment, no duplicate pages). */
export function useLocalePath(locale: UiLang) {
  return function localePath(path: string): string {
    return path === '/' ? `/${locale}` : `/${locale}${path}`
  }
}

export function isEnabledUiLang(lang: UiLang): boolean {
  return enabledLanguages.includes(lang)
}

export function coerceUiLang(value: string | null | undefined): UiLang {
  if (value && isUiLanguage(value) && isEnabledUiLang(value)) {
    return value
  }
  return defaultLang
}
