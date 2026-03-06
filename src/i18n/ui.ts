import enRaw from '../../messages/en.json'
import frRaw from '../../messages/fr.json'
import { CONFIG } from '../config'

function stripSchema(o: Record<string, unknown>): Record<string, string> {
  const { $schema, ...rest } = o
  return rest as Record<string, string>
}

export const languages = CONFIG.i18n.languageLabels
export type UiLanguage = keyof typeof languages
export const enabledLanguages: readonly UiLanguage[] =
  CONFIG.i18n.enabledLanguages
export const defaultLang = CONFIG.i18n.defaultLang
export const showDefaultLang = false

export const ui = {
  en: stripSchema(enRaw as Record<string, unknown>),
  fr: stripSchema(frRaw as Record<string, unknown>)
} as const satisfies Record<UiLanguage, Record<string, string>>
