import type { CourseStructure } from '../../courses/types'
import type { UiLang } from '../courses/types'
import type { OverviewChapter, OverviewLesson } from './types'
import type { ChapterMeta } from './port'
import { stripNumericPrefix } from '../utils'

export function getChapterIdsFromStructure(
  structure: CourseStructure,
  chapterDirsByModule: Map<
    string,
    Array<{ chapterDir: string; chapterId: string }>
  >
): Array<{ moduleId: string; chapterId: string }> {
  const out: Array<{ moduleId: string; chapterId: string }> = []

  for (const ch of structure.chapters) {
    if (ch.chapterId === 'all') {
      const dirs = chapterDirsByModule.get(ch.moduleId) ?? []
      for (const { chapterId } of dirs) {
        out.push({ moduleId: ch.moduleId, chapterId })
      }
    } else {
      out.push({ moduleId: ch.moduleId, chapterId: ch.chapterId })
    }
  }

  return out
}

export function buildChapter(
  moduleId: string,
  chapterId: string,
  meta: ChapterMeta | undefined,
  lessonDirsMap: Map<string, string[]>,
  lessonTitles: Map<string, string>,
  lang: UiLang
): OverviewChapter {
  const dirs = lessonDirsMap.get(`${moduleId}:${chapterId}`) ?? []

  const lessons: OverviewLesson[] = dirs.map((lessonDir) => {
    const lessonId = stripNumericPrefix(lessonDir)
    const title =
      lessonTitles.get(`${moduleId}:${chapterId}:${lessonId}:${lang}`) ??
      lessonId

    const hasEnvironment = !!(meta?.environment && meta.environment !== 'empty')

    return { id: lessonId, title, hasEnvironment }
  })

  return {
    id: chapterId,
    moduleId,
    title: meta?.title?.[lang] ?? meta?.title?.en ?? chapterId,
    description: meta?.description?.[lang] ?? meta?.description?.en,
    isFree: meta?.isFree,
    environment: meta?.environment,
    lessons
  }
}
