import { I18N_CONFIG, type UiLanguage } from '../config/i18nConfig'

function isUiLanguage(value: string): value is UiLanguage {
  return Object.hasOwn(I18N_CONFIG.languageLabels, value)
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
  if (I18N_CONFIG.enabledLanguages.includes(firstSegment)) {
    return null
  }

  const remainingPath =
    remainingSegments.length > 0 ? `/${remainingSegments.join('/')}` : ''
  return `/${I18N_CONFIG.defaultLang}${remainingPath}${search}`
}
