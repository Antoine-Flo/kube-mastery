import type { MarkdownInstance } from 'astro'

export interface LessonFrontmatter {
  seoTitle?: string
  seoDescription?: string
  ogImage?: string
  twitterImage?: string
}

export interface OverviewLesson {
  id: string
  title: string
  hasEnvironment: boolean
  isPlaceholder: boolean
}

/** One expandable row in the UI: a module with its lessons. */
export interface OverviewModule {
  moduleId: string
  title: string
  lessons: OverviewLesson[]
  isLocked: boolean
}

export interface CourseOverview {
  id: string
  title: string
  shortDescription: string | null
  level: string | null
  comingSoon: boolean
  content: { sections: Array<{ title: string; modules: OverviewModule[] }> }
  descriptionContent: MarkdownInstance<Record<string, unknown>> | null
  description: string | null
}

export type OverviewType = 'courses' | 'modules'

export interface LessonLocation {
  moduleId: string
  topicDir: string
}
