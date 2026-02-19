import type { MarkdownInstance } from 'astro'
import type { LocalModule } from '../../oldCourses/types'
import type { CourseStructure, CourseFrontmatter, UiLang } from './types'

export interface CourseDataPort {
  getCourseIds(): string[]
  getCourseMarkdown(
    courseId: string,
    lang: UiLang
  ): MarkdownInstance<CourseFrontmatter> | null
  getLessonIndex(): Map<string, Map<string, Set<string>>>
  getCourseStructure(courseId: string): CourseStructure | undefined
  getModuleEntries(): Array<{ moduleId: string; module: LocalModule }>
  getModule(moduleId: string): LocalModule | undefined
}
