import { defaultLang, enabledLanguages, type UiLanguage } from './ui'

/** Path prefixes that must not get a locale redirect (e.g. API). */
const LOCALE_SKIP_PREFIXES = [
  'api',
  '@id',
  '@fs',
  '_astro',
  'astro',
  'node_modules',
  'vite'
]

export function getDisabledLocaleRedirectPath(
  pathname: string,
  search: string
): string | null {
  if (pathname.startsWith('/@') || pathname.startsWith('/_astro/')) {
    return null
  }
  const [, firstSegment, ...remainingSegments] = pathname.split('/')
  if (!firstSegment) {
    return null
  }
  if (LOCALE_SKIP_PREFIXES.includes(firstSegment)) {
    return null
  }
  if (remainingSegments.length === 0 && firstSegment.includes('.')) {
    return null
  }
  if (enabledLanguages.includes(firstSegment as UiLanguage)) {
    return null
  }

  const remainingPath =
    remainingSegments.length > 0 ? `/${remainingSegments.join('/')}` : ''
  return `/${defaultLang}${remainingPath}${search}`
}
