import type { CourseStructure } from '../courses/types'
import type { UiLang } from '../courses/types'
import type { OverviewModule, OverviewLesson } from './types'

export function getOrderedModuleTopicPairs(
  structure: CourseStructure,
  topicDirsByModule: Map<string, Array<{ topicDir: string; topicId: string }>>
): Array<{ moduleId: string; topicId: string }> {
  const out: Array<{ moduleId: string; topicId: string }> = []

  for (const section of structure.sections) {
    for (const moduleId of section.moduleIds) {
      const topics = topicDirsByModule.get(moduleId) ?? []
      for (const { topicId } of topics) {
        out.push({ moduleId, topicId })
      }
    }
  }

  return out
}

export function buildModule(
  moduleId: string,
  topicIdsInOrder: Array<{ topicId: string }>,
  moduleTitle: string,
  lessonTitles: Map<string, string>,
  placeholderLessonIds: Set<string>,
  _lessonDirsByTopic: Map<string, string[]>,
  lang: UiLang,
  isDraft: boolean = false
): OverviewModule {
  const lessons: OverviewLesson[] = topicIdsInOrder.map(({ topicId }) => {
    const title = lessonTitles.get(`${moduleId}:${topicId}:${lang}`) ?? topicId
    return {
      id: topicId,
      title,
      hasEnvironment: false,
      isPlaceholder: isDraft || placeholderLessonIds.has(topicId)
    }
  })

  const isLocked = lessons.some((lesson) => lesson.isPlaceholder)

  return {
    moduleId,
    title: moduleTitle,
    lessons,
    isLocked
  }
}
