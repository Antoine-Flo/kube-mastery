export interface LocalModule {
  title: { en: string; fr: string }
  description?: { en?: string; fr?: string }
  tags?: string[]
}

export interface CourseStructure {
  chapters: Array<{
    moduleId: string
    chapterId: string | 'all' // 'all' = tous les chapitres du module
    order?: number // Optionnel pour réordonner dans le cours
  }>
}
