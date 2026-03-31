import type { MarkdownInstance } from 'astro'
import type { Quiz } from '../../types/quiz'
import type { UiLang } from '../courses/types'
import type { OverviewIndexPort, LessonContentPort } from './port'
import type { LessonFrontmatter, LessonLocation } from './types'
import { stripNumericPrefix, parseH1 } from '../utils'

const lessonTitleGlob = import.meta.glob<string>(
  '../../courses/modules/**/content.md',
  {
    eager: true,
    query: '?raw',
    import: 'default'
  }
)
const contentMdPathsGlob = import.meta.glob(
  '../../courses/modules/**/content.md'
)

const contentMdGlobKeys = Object.keys(contentMdPathsGlob)

const contentRawGlob = import.meta.glob<string>(
  '../../courses/modules/**/content.md',
  {
    eager: true,
    query: '?raw',
    import: 'default'
  }
)
const contentAsMarkdownGlob = import.meta.glob<MarkdownInstance<LessonFrontmatter>>(
  '../../courses/modules/**/content.md',
  { eager: true }
)
const quizGlob = import.meta.glob<{ quiz?: Quiz }>(
  '../../courses/modules/**/quiz.ts',
  { eager: true }
)

/** Path shape: modules/{moduleId}/{topicDir}/{lang}/content.md */
function buildLessonTitleIndex(): Map<string, string> {
  const index = new Map<string, string>()

  for (const [path, content] of Object.entries(lessonTitleGlob)) {
    const text = content ?? ''
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')
    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const topicDir = parts[modulesIdx + 2]
    const lang = parts[modulesIdx + 3]
    if (lang !== 'en' && lang !== 'fr') {
      continue
    }

    const topicId = stripNumericPrefix(topicDir)
    const title = parseH1(text) || topicId
    index.set(`${moduleId}:${topicId}:${lang}`, title)
  }
  return index
}

function buildTopicDirsByModule(): Map<
  string,
  Array<{ topicDir: string; topicId: string }>
> {
  const seen = new Map<string, Set<string>>()

  for (const path of contentMdGlobKeys) {
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')
    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const topicDir = parts[modulesIdx + 2]
    const topicId = stripNumericPrefix(topicDir)
    if (!seen.has(moduleId)) {
      seen.set(moduleId, new Set())
    }
    seen.get(moduleId)!.add(JSON.stringify({ topicDir, topicId }))
  }

  const out = new Map<string, Array<{ topicDir: string; topicId: string }>>()

  for (const [moduleId, set] of seen) {
    const arr = Array.from(set).map(
      (s) => JSON.parse(s) as { topicDir: string; topicId: string }
    )
    arr.sort((a, b) => a.topicDir.localeCompare(b.topicDir))
    out.set(moduleId, arr)
  }

  return out
}

/** Key = moduleId:topicId. Value = [topicDir] (one lesson per topic in new structure). */
function buildLessonDirsByTopic(): Map<string, string[]> {
  const seen = new Map<string, Set<string>>()

  for (const path of contentMdGlobKeys) {
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')

    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const topicDir = parts[modulesIdx + 2]
    const topicId = stripNumericPrefix(topicDir)
    const key = `${moduleId}:${topicId}`
    if (!seen.has(key)) {
      seen.set(key, new Set())
    }
    seen.get(key)!.add(topicDir)
  }

  const out = new Map<string, string[]>()

  for (const [key, set] of seen) {
    out.set(key, Array.from(set).sort())
  }

  return out
}

function stripFrontmatter(raw: string): string {
  const normalized = raw.replace(/\r\n/g, '\n').trim()
  if (!normalized.startsWith('---\n')) {
    return normalized
  }
  return normalized.replace(/^---[\s\S]*?\n---\n?/, '').trim()
}

function isPlaceholderLesson(raw: string): boolean {
  const withoutFrontmatter = stripFrontmatter(raw)
  const nonEmptyLines = withoutFrontmatter
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (nonEmptyLines.length === 0) {
    return false
  }

  if (nonEmptyLines.length === 1) {
    return nonEmptyLines[0].toLowerCase() === 'placeholder'
  }

  if (nonEmptyLines.length === 2 && nonEmptyLines[0].startsWith('#')) {
    return nonEmptyLines[1].toLowerCase() === 'placeholder'
  }

  return false
}

function buildPlaceholderLessonIdsByModule(): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()

  for (const [path, raw] of Object.entries(contentRawGlob)) {
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')
    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const topicDir = parts[modulesIdx + 2]
    const lang = parts[modulesIdx + 3]
    if (lang !== 'en') {
      continue
    }
    if (!isPlaceholderLesson(raw ?? '')) {
      continue
    }

    if (!out.has(moduleId)) {
      out.set(moduleId, new Set())
    }
    out.get(moduleId)!.add(stripNumericPrefix(topicDir))
  }

  return out
}

let lessonTitleIndex: Map<string, string> | null = null
let topicDirsByModule: Map<
  string,
  Array<{ topicDir: string; topicId: string }>
> | null = null
let lessonDirsByTopic: Map<string, string[]> | null = null
let placeholderLessonIdsByModule: Map<string, Set<string>> | null = null

const indexPort: OverviewIndexPort = {
  getLessonTitleIndex() {
    if (!lessonTitleIndex) {
      lessonTitleIndex = buildLessonTitleIndex()
    }
    return lessonTitleIndex
  },
  getTopicDirsByModule() {
    if (!topicDirsByModule) {
      topicDirsByModule = buildTopicDirsByModule()
    }
    return topicDirsByModule
  },
  getLessonDirsByTopic() {
    if (!lessonDirsByTopic) {
      lessonDirsByTopic = buildLessonDirsByTopic()
    }
    return lessonDirsByTopic
  },
  getPlaceholderLessonIdsByModule() {
    if (!placeholderLessonIdsByModule) {
      placeholderLessonIdsByModule = buildPlaceholderLessonIdsByModule()
    }
    return placeholderLessonIdsByModule
  }
}

function contentPath(loc: LessonLocation, lang: UiLang): string {
  return `modules/${loc.moduleId}/${loc.topicDir}/${lang}/content.md`
}

function quizPath(loc: LessonLocation, lang: UiLang): string {
  return `modules/${loc.moduleId}/${loc.topicDir}/${lang}/quiz.ts`
}

const contentPort: LessonContentPort = {
  getLessonMarkdown(loc: LessonLocation, lang: UiLang): string | null {
    const suffix = contentPath(loc, lang)
    const found = Object.keys(contentRawGlob).find((k) => k.endsWith(suffix))
    return found ? (contentRawGlob[found] ?? null) : null
  },

  getLessonContent(
    loc: LessonLocation,
    lang: UiLang
  ): MarkdownInstance<LessonFrontmatter> | null {
    const found = Object.keys(contentAsMarkdownGlob).find((k) =>
      k.endsWith(contentPath(loc, lang))
    )
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

export function createOverviewGlobAdapter(): OverviewIndexPort &
  LessonContentPort {
  return {
    ...indexPort,
    ...contentPort
  }
}
