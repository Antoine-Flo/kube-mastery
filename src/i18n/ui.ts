import enRaw from '../../messages/en.json'
import frRaw from '../../messages/fr.json'

function stripSchema(o: Record<string, unknown>): Record<string, string> {
  const { $schema, ...rest } = o
  return rest as Record<string, string>
}

export const languages = { en: 'English', fr: 'Français' } as const
export const defaultLang = 'en'
export const showDefaultLang = false

export const ui = {
  en: stripSchema(enRaw as Record<string, unknown>),
  fr: stripSchema(frRaw as Record<string, unknown>)
} as const
