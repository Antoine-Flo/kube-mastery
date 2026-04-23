import type { MarkdownInstance } from 'astro'
import {
  getCourseMarkdown,
  getCourseStructure,
  getModule
} from '../courses/facade'
import type { UiLang } from '../courses/types'
import { buildModule } from './domain'
import { createOverviewGlobAdapter } from './glob-adapter'
import type {
  CourseOverview,
  LessonFrontmatter,
  LessonLocation,
  OverviewModule,
  OverviewType
} from './types'
import type { Quiz } from '../../types/quiz'

let adapter: ReturnType<typeof createOverviewGlobAdapter> | null = null

function getAdapter() {
  if (!adapter) {
    adapter = createOverviewGlobAdapter()
  }
  return adapter
}

export type {
  CourseOverview,
  LessonFrontmatter,
  OverviewModule,
  OverviewLesson,
  OverviewType,
  LessonLocation
} from './types'

function buildLessonSourceRepoPath(args: {
  moduleId: string
  topicDir: string
  lang: UiLang
}): string {
  return `src/courses/modules/${args.moduleId}/${args.topicDir}/${args.lang}/content.md`
}

export function getCourseOverview(
  courseId: string,
  lang: UiLang
): CourseOverview | null {
  const entry = getCourseMarkdown(courseId, lang)
  if (!entry) {
    return null
  }
  const fm = entry.frontmatter
  if (fm.isActive === false) {
    return null
  }

  const structure = getCourseStructure(courseId)
  if (!structure) {
    return null
  }

  const index = getAdapter()
  const topicDirsByModule = index.getTopicDirsByModule()
  const lessonTitles = index.getLessonTitleIndex()
  const lessonDirsByTopic = index.getLessonDirsByTopic()
  const placeholderLessonIdsByModule = index.getPlaceholderLessonIdsByModule()

  const sections = structure.sections.map((section) => {
    const modules: OverviewModule[] = section.moduleIds.map((moduleId) => {
      const mod = getModule(moduleId)
      const title = mod?.title?.[lang] ?? mod?.title?.en ?? moduleId
      const topics = topicDirsByModule.get(moduleId) ?? []
      const isDraft = mod?.draft ?? false
      return buildModule(
        moduleId,
        topics.map((t) => ({ topicId: t.topicId })),
        title,
        lessonTitles,
        placeholderLessonIdsByModule.get(moduleId) ?? new Set<string>(),
        lessonDirsByTopic,
        lang,
        isDraft
      )
    })
    return {
      title: section.title.en,
      modules
    }
  })

  return {
    id: courseId,
    title: fm.title,
    shortDescription: fm.shortDescription ?? null,
    level: fm.level ?? null,
    comingSoon: fm.comingSoon ?? false,
    content: { sections },
    descriptionContent: entry as unknown as MarkdownInstance<
      Record<string, unknown>
    >,
    description: null
  }
}

export function getModuleOverview(
  moduleId: string,
  lang: UiLang
): CourseOverview | null {
  const mod = getModule(moduleId)
  if (!mod) {
    return null
  }

  const index = getAdapter()
  const topics = index.getTopicDirsByModule().get(moduleId) ?? []
  if (topics.length === 0) {
    return null
  }

  const lessonTitles = index.getLessonTitleIndex()
  const lessonDirsByTopic = index.getLessonDirsByTopic()
  const placeholderLessonIdsByModule = index.getPlaceholderLessonIdsByModule()
  const title = mod.title[lang] ?? mod.title.en
  const isDraft = mod.draft ?? false
  const overviewModule = buildModule(
    moduleId,
    topics.map((t) => ({ topicId: t.topicId })),
    title,
    lessonTitles,
    placeholderLessonIdsByModule.get(moduleId) ?? new Set<string>(),
    lessonDirsByTopic,
    lang,
    isDraft
  )

  return {
    id: moduleId,
    title,
    shortDescription: mod.description?.[lang] ?? mod.description?.en ?? null,
    level: null,
    comingSoon: false,
    content: {
      sections: [{ title, modules: [overviewModule] }]
    },
    descriptionContent: null,
    description: mod.description?.[lang] ?? mod.description?.en ?? null
  }
}

function getLessonLocation(
  type: OverviewType,
  id: string,
  lessonId: string
): LessonLocation | null {
  const lang: UiLang = 'en'
  const overview =
    type === 'courses'
      ? getCourseOverview(id, lang)
      : getModuleOverview(id, lang)

  if (!overview) {
    return null
  }

  for (const section of overview.content.sections) {
    for (const module of section.modules) {
      const lesson = module.lessons.find((l) => l.id === lessonId)
      if (!lesson) {
        continue
      }

      const topicDirs =
        getAdapter()
          .getLessonDirsByTopic()
          .get(`${module.moduleId}:${lessonId}`) ?? []
      const topicDir = topicDirs[0]
      if (!topicDir) {
        return null
      }

      return {
        moduleId: module.moduleId,
        topicDir
      }
    }
  }
  return null
}

export function getLessonContent(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): MarkdownInstance<LessonFrontmatter> | null {
  const overview =
    type === 'courses'
      ? getCourseOverview(id, lang)
      : getModuleOverview(id, lang)
  if (!overview) {
    return null
  }
  const lessonMeta = overview.content.sections
    .flatMap((section) => section.modules)
    .flatMap((module) => module.lessons)
    .find((lesson) => lesson.id === lessonId)
  if (!lessonMeta || lessonMeta.isPlaceholder) {
    return null
  }

  const loc = getLessonLocation(type, id, lessonId)
  if (!loc) {
    return null
  }

  return getAdapter().getLessonContent(loc, lang)
}

export function getLessonQuiz(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): Quiz | null {
  const loc = getLessonLocation(type, id, lessonId)
  if (!loc) {
    return null
  }

  return getAdapter().getLessonQuiz(loc, lang)
}

export function getLessonSourceRepoPath(
  type: OverviewType,
  id: string,
  lessonId: string,
  lang: UiLang
): string {
  const loc = getLessonLocation(type, id, lessonId)!

  return buildLessonSourceRepoPath({
    moduleId: loc.moduleId,
    topicDir: loc.topicDir,
    lang
  })
}
