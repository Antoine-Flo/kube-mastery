export interface LocalModuleText {
  en: string
  fr?: string
}

export interface LocalModule {
  title: LocalModuleText
  description: LocalModuleText
  tags: string[]
  draft?: boolean
}
