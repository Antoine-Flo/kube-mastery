import type { MarkdownInstance } from 'astro'
import type { Quiz } from '../../types/quiz'
import type { UiLang } from '../courses/types'
import type { OverviewIndexPort, LessonContentPort, ChapterMeta } from './port'
import type { LessonLocation } from './types'
import { stripNumericPrefix, parseH1 } from '../utils'

const lessonTitleGlob = import.meta.glob<string>('../../courses/modules/**/content.md', {
  eager: true,
  query: '?raw',
  import: 'default'
})
const chapterMetaGlob = import.meta.glob<{ default: Record<string, unknown> }>(
  '../../courses/modules/*/*/chapter.json',
  { eager: true, import: 'default' }
)
const contentMdPathsGlob = import.meta.glob('../../courses/modules/**/content.md')

const contentMdGlobKeys = Object.keys(contentMdPathsGlob)

const contentRawGlob = import.meta.glob<string>('../../courses/modules/**/content.md', {
  eager: true,
  query: '?raw',
  import: 'default'
})
const contentAsMarkdownGlob = import.meta.glob<MarkdownInstance<Record<string, unknown>>>(
  '../../courses/modules/**/content.md',
  { eager: true }
)
const quizGlob = import.meta.glob<{ quiz?: Quiz }>('../../courses/modules/**/quiz.ts', { eager: true })

function buildLessonTitleIndex(): Map<string, string> {
  const index = new Map<string, string>()

  for (const [path, content] of Object.entries(lessonTitleGlob)) {
    const text = content ?? ''
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')
    if (modulesIdx === -1 || parts.length < modulesIdx + 5) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const chapterDir = parts[modulesIdx + 2]
    const lessonDir = parts[modulesIdx + 3]
    const lang = parts[modulesIdx + 4]
    if (lang !== 'en' && lang !== 'fr') {
      continue
    }

    const chapterId = stripNumericPrefix(chapterDir)
    const lessonId = stripNumericPrefix(lessonDir)
    const title = parseH1(text)
    index.set(`${moduleId}:${chapterId}:${lessonId}:${lang}`, title)
  }
  return index
}

function buildChapterMetaIndex(): Map<string, ChapterMeta> {
  const index = new Map<string, ChapterMeta>()

  for (const [path, data] of Object.entries(chapterMetaGlob)) {
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')

    if (modulesIdx === -1 || parts.length < modulesIdx + 3) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const chapterDir = parts[modulesIdx + 2]
    const chapterId = stripNumericPrefix(chapterDir)

    const raw = data as unknown as {
      title?: { en?: string; fr?: string }
      description?: { en?: string; fr?: string }
      isFree?: boolean
      environment?: string
    }

    index.set(`${moduleId}:${chapterId}`, {
      title: { en: raw.title?.en ?? '', fr: raw.title?.fr ?? '' },
      description: raw.description ? { en: raw.description.en ?? '', fr: raw.description.fr ?? '' } : undefined,
      isFree: raw.isFree,
      environment: raw.environment
    })
  }
  return index
}

function buildChapterDirsByModule(): Map<string, Array<{ chapterDir: string; chapterId: string }>> {
  const seen = new Map<string, Set<string>>()

  for (const path of contentMdGlobKeys) {
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')
    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const chapterDir = parts[modulesIdx + 2]
    const chapterId = stripNumericPrefix(chapterDir)
    if (!seen.has(moduleId)) {
      seen.set(moduleId, new Set())
    }
    seen.get(moduleId)!.add(JSON.stringify({ chapterDir, chapterId }))
  }

  const out = new Map<string, Array<{ chapterDir: string; chapterId: string }>>()

  for (const [moduleId, set] of seen) {
    const arr = Array.from(set).map((s) => JSON.parse(s) as { chapterDir: string; chapterId: string })
    arr.sort((a, b) => a.chapterDir.localeCompare(b.chapterDir))
    out.set(moduleId, arr)
  }

  return out
}

function buildLessonDirsByChapter(): Map<string, string[]> {
  const seen = new Map<string, Set<string>>()

  for (const path of contentMdGlobKeys) {
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')

    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const chapterDir = parts[modulesIdx + 2]
    const lessonDir = parts[modulesIdx + 3]
    const chapterId = stripNumericPrefix(chapterDir)
    const key = `${moduleId}:${chapterId}`
    if (!seen.has(key)) {
      seen.set(key, new Set())
    }
    seen.get(key)!.add(lessonDir)
  }

  const out = new Map<string, string[]>()

  for (const [key, set] of seen) {
    out.set(key, Array.from(set).sort())
  }

  return out
}

let lessonTitleIndex: Map<string, string> | null = null
let chapterMetaIndex: Map<string, ChapterMeta> | null = null
let chapterDirsByModule: Map<string, Array<{ chapterDir: string; chapterId: string }>> | null = null
let lessonDirsByChapter: Map<string, string[]> | null = null

const indexPort: OverviewIndexPort = {
  getLessonTitleIndex() {
    if (!lessonTitleIndex) {
      lessonTitleIndex = buildLessonTitleIndex()
    }
    return lessonTitleIndex
  },
  getChapterMetaIndex() {
    if (!chapterMetaIndex) {
      chapterMetaIndex = buildChapterMetaIndex()
    }
    return chapterMetaIndex
  },
  getChapterDirsByModule() {
    if (!chapterDirsByModule) {
      chapterDirsByModule = buildChapterDirsByModule()
    }
    return chapterDirsByModule
  },
  getLessonDirsByChapter() {
    if (!lessonDirsByChapter) {
      lessonDirsByChapter = buildLessonDirsByChapter()
    }
    return lessonDirsByChapter
  }
}

function contentPath(loc: LessonLocation, lang: UiLang): string {
  return `modules/${loc.moduleId}/${loc.chapterDir}/${loc.lessonDir}/${lang}/content.md`
}

function quizPath(loc: LessonLocation, lang: UiLang): string {
  return `modules/${loc.moduleId}/${loc.chapterDir}/${loc.lessonDir}/${lang}/quiz.ts`
}

const contentPort: LessonContentPort = {
  getLessonMarkdown(loc: LessonLocation, lang: UiLang): string | null {
    const suffix = contentPath(loc, lang)
    const found = Object.keys(contentRawGlob).find((k) => k.endsWith(suffix))
    return found ? (contentRawGlob[found] ?? null) : null
  },

  getLessonContent(loc: LessonLocation, lang: UiLang): MarkdownInstance<Record<string, unknown>> | null {
    const found = Object.keys(contentAsMarkdownGlob).find((k) => k.endsWith(contentPath(loc, lang)))
    return found ? (contentAsMarkdownGlob[found] ?? null) : null
  },

  getLessonQuiz(loc: LessonLocation, lang: UiLang): Quiz | null {
    const suffix = quizPath(loc, lang)
    const found = Object.keys(quizGlob).find((k) => k.endsWith(suffix))
    if (!found) {
      return null
    }
    return quizGlob[found]?.quiz ?? null
  }
}

export function createOverviewGlobAdapter(): OverviewIndexPort & LessonContentPort {
  return {
    ...indexPort,
    ...contentPort
  }
}
