import {
  defaultLang,
  enabledLanguages,
  languages,
  type UiLanguage
} from './ui'

function isUiLanguage(value: string): value is UiLanguage {
  return Object.hasOwn(languages, value)
}

export function getDisabledLocaleRedirectPath(
  pathname: string,
  search: string
): string | null {
  const [, firstSegment, ...remainingSegments] = pathname.split('/')
  if (!firstSegment) {
    return null
  }
  if (!isUiLanguage(firstSegment)) {
    return null
  }
  if (enabledLanguages.includes(firstSegment)) {
    return null
  }

  const remainingPath =
    remainingSegments.length > 0 ? `/${remainingSegments.join('/')}` : ''
  return `/${defaultLang}${remainingPath}${search}`
}
