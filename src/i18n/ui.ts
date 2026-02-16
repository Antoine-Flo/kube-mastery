import enRaw from '../../messages/en.json'
import frRaw from '../../messages/fr.json'
import { I18N_CONFIG, type UiLanguage } from '../config/i18nConfig'

function stripSchema(o: Record<string, unknown>): Record<string, string> {
  const { $schema, ...rest } = o
  return rest as Record<string, string>
}

export const languages = I18N_CONFIG.languageLabels
export const enabledLanguages = I18N_CONFIG.enabledLanguages
export const defaultLang = I18N_CONFIG.defaultLang
export const showDefaultLang = false

export const ui = {
  en: stripSchema(enRaw as Record<string, unknown>),
  fr: stripSchema(frRaw as Record<string, unknown>)
} as const satisfies Record<UiLanguage, Record<string, string>>
