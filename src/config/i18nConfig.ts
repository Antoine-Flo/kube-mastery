export const ENABLE_FRENCH_UI = false as const

const LANGUAGE_LABELS = {
  en: 'English',
  fr: 'Français'
} as const

export type UiLanguage = keyof typeof LANGUAGE_LABELS

export const I18N_CONFIG = {
  defaultLang: 'en' as const,
  enabledLanguages: (ENABLE_FRENCH_UI
    ? ['en', 'fr']
    : ['en']) as readonly UiLanguage[],
  languageLabels: LANGUAGE_LABELS
} as const
