export type UiLang = 'en' | 'fr'

/** Course structure: sections only. Each section has a title and ordered moduleIds. */
export interface CourseStructure {
  sections: Array<{
    id?: string
    title: { en: string }
    moduleIds: string[]
  }>
}

export interface CourseFrontmatter {
  title: string
  shortDescription: string
  isActive?: boolean
  price?: number
  comingSoon?: boolean
  inProgress?: boolean
  order?: number
  level?: string
}

export interface CourseListItem {
  id: string
  title: string
  description: string | null
  shortDescription: string | null
  level: string | null
  comingSoon: boolean
  inProgress: boolean
  order: number
  totalLessons: number
}

export interface ModuleListItem {
  id: string
  title: string
  description: string | null
  totalLessons: number
}
