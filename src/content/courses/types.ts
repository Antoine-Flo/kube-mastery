export type UiLang = 'en' | 'fr'

export interface CourseFrontmatter {
  title: string
  shortDescription: string
  isActive?: boolean
  price?: number
  comingSoon?: boolean
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
  order: number
  totalLessons: number
}

export interface ModuleListItem {
  id: string
  title: string
  description: string | null
  totalLessons: number
}
