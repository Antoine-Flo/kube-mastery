import {
  getCourseOverview,
  type LessonFrontmatter,
  type OverviewType
} from '../../content/overview/facade'
import {
  getCourses,
  getCourseStructure
} from '../../content/courses/facade'
import { getFirstNonPlaceholderLessonIdFromSections } from './lessonTerminalAccess'

type Language = 'en' | 'fr'
type LocalePathBuilder = (path: string) => string

export type ModuleCourseContext = {
  moduleIsInFreeCourse: boolean
  canonicalCourseIdForModule: string | null
}

export type LessonNavigationState = {
  currentLessonTitle: string | null
  prevHref: string
  nextHref: string
  isFirst: boolean
  isLast: boolean
}

function getOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return undefined
  }

  return trimmed
}

export function getModuleCourseContext(
  language: Language,
  moduleId: string
): ModuleCourseContext {
  const courses = getCourses(language)
  let moduleIsInFreeCourse = false
  let canonicalCourseIdForModule: string | null = null

  for (const course of courses) {
    const structure = getCourseStructure(course.id)
    if (!structure) {
      continue
    }

    const containsModule = structure.sections.some((section) => {
      return section.moduleIds.includes(moduleId)
    })

    if (!containsModule) {
      continue
    }

    if (!canonicalCourseIdForModule) {
      canonicalCourseIdForModule = course.id
    }

    if (course.isFree) {
      moduleIsInFreeCourse = true
    }

    if (moduleIsInFreeCourse && canonicalCourseIdForModule) {
      break
    }
  }

  return {
    moduleIsInFreeCourse,
    canonicalCourseIdForModule
  }
}

export function buildTerminalLockSecondaryHref(
  language: Language,
  localePath: LocalePathBuilder
): string {
  const crashOverview = getCourseOverview('crash-course', language)
  const crashFirstLessonId = crashOverview
    ? getFirstNonPlaceholderLessonIdFromSections(crashOverview.content.sections)
    : null

  if (!crashFirstLessonId) {
    return localePath('/courses')
  }

  return localePath(`/courses/crash-course/${crashFirstLessonId}`)
}

export function buildLessonNavigationState(params: {
  allLessons: Array<{ id: string; title: string }>
  currentLessonId: string
  overviewType: OverviewType
  learnableId: string
  localePath: LocalePathBuilder
}): LessonNavigationState {
  const currentIndex = params.allLessons.findIndex((lesson) => {
    return lesson.id === params.currentLessonId
  })

  const currentLesson =
    currentIndex >= 0 ? params.allLessons[currentIndex] : null
  const prevLesson =
    currentIndex > 0 ? params.allLessons[currentIndex - 1] : null
  const nextLesson =
    currentIndex < params.allLessons.length - 1
      ? params.allLessons[currentIndex + 1]
      : null

  return {
    currentLessonTitle: currentLesson?.title ?? null,
    prevHref: prevLesson
      ? params.localePath(
          `/${params.overviewType}/${params.learnableId}/${prevLesson.id}`
        )
      : '',
    nextHref: nextLesson
      ? params.localePath(
          `/${params.overviewType}/${params.learnableId}/${nextLesson.id}`
        )
      : params.localePath(`/${params.overviewType}/${params.learnableId}/complete`),
    isFirst: currentIndex === 0,
    isLast: currentIndex >= params.allLessons.length - 1
  }
}

export function buildLessonSeo(params: {
  lessonFrontmatter: LessonFrontmatter
  currentLessonTitle: string
  defaultDescription?: string
  overviewType: OverviewType
  learnableId: string
  currentLessonId: string
  canonicalCourseIdForModule: string | null
  localePath: LocalePathBuilder
  origin: string
}) {
  const canonicalPath =
    params.overviewType === 'modules' && params.canonicalCourseIdForModule
      ? params.localePath(
          `/courses/${params.canonicalCourseIdForModule}/${params.currentLessonId}`
        )
      : params.localePath(
          `/${params.overviewType}/${params.learnableId}/${params.currentLessonId}`
        )

  return {
    title:
      getOptionalString(params.lessonFrontmatter.seoTitle) ??
      `${params.currentLessonTitle} | KubeMastery`,
    description:
      getOptionalString(params.lessonFrontmatter.seoDescription) ??
      params.defaultDescription,
    canonical: new URL(canonicalPath, params.origin).href,
    openGraphType: 'article',
    openGraphImage: getOptionalString(params.lessonFrontmatter.ogImage),
    twitterImage: getOptionalString(params.lessonFrontmatter.twitterImage)
  }
}
