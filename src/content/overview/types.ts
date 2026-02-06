import type { MarkdownInstance } from 'astro'

export interface OverviewLesson {
  id: string
  title: string
  hasEnvironment: boolean
}

export interface OverviewChapter {
  id: string
  moduleId?: string
  title: string
  description?: string
  isFree?: boolean
  environment?: string
  lessons: OverviewLesson[]
}

export interface CourseOverview {
  id: string
  title: string
  shortDescription: string | null
  level: string | null
  isFree: boolean
  comingSoon: boolean
  content: { chapters: OverviewChapter[] }
  descriptionContent: MarkdownInstance<Record<string, unknown>> | null
  description: string | null
}

export type OverviewType = 'courses' | 'modules'

export interface LessonLocation {
  moduleId: string
  chapterDir: string
  lessonDir: string
}
