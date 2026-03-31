import type { UiLang } from '../courses/types'
import type { LessonFrontmatter, LessonLocation } from './types'
import type { Quiz } from '../../types/quiz'
import type { MarkdownInstance } from 'astro'

export interface OverviewIndexPort {
  getLessonTitleIndex(): Map<string, string>
  getTopicDirsByModule(): Map<
    string,
    Array<{ topicDir: string; topicId: string }>
  >
  getLessonDirsByTopic(): Map<string, string[]>
  getPlaceholderLessonIdsByModule(): Map<string, Set<string>>
}

export interface LessonContentPort {
  getLessonMarkdown(loc: LessonLocation, lang: UiLang): string | null
  getLessonContent(
    loc: LessonLocation,
    lang: UiLang
  ): MarkdownInstance<LessonFrontmatter> | null
  getLessonQuiz(loc: LessonLocation, lang: UiLang): Quiz | null
}
