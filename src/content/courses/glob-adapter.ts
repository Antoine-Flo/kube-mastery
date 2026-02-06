import type { MarkdownInstance } from 'astro'
import type { CourseStructure, LocalModule } from '../../courses/types'
import type { CourseDataPort } from './port'
import type { CourseFrontmatter, UiLang } from './types'
import { stripNumericPrefix } from '../utils'

function buildLessonIndex(): Map<string, Map<string, Set<string>>> {
  const index = new Map<string, Map<string, Set<string>>>()
  const glob = import.meta.glob('../../courses/modules/**/content.md')

  for (const path of Object.keys(glob)) {
    const parts = path.split('/')
    const modulesIdx = parts.indexOf('modules')

    if (modulesIdx === -1 || parts.length < modulesIdx + 4) {
      continue
    }

    const moduleId = parts[modulesIdx + 1]
    const chapterDir = parts[modulesIdx + 2]
    const lessonDir = parts[modulesIdx + 3]
    const chapterId = stripNumericPrefix(chapterDir)
    const lessonId = stripNumericPrefix(lessonDir)

    if (!index.has(moduleId)) {
      index.set(moduleId, new Map())
    }

    const mod = index.get(moduleId)!

    if (!mod.has(chapterId)) {
      mod.set(chapterId, new Set())
    }

    mod.get(chapterId)!.add(lessonId)
  }

  return index
}

let lessonIndexCache: Map<string, Map<string, Set<string>>> | null = null

const courseMdGlob = import.meta.glob<MarkdownInstance<CourseFrontmatter>>('../../courses/*/{en,fr}.md', {
  eager: true
})
const structuresGlob = import.meta.glob('../../courses/*/course-structure.ts', { eager: true }) as Record<
  string,
  { courseStructure: CourseStructure }
>
const modulesGlob = import.meta.glob('../../courses/modules/*/module.ts', { eager: true }) as Record<
  string,
  { module: LocalModule }
>

export function createCourseGlobAdapter(): CourseDataPort {
  return {
    getCourseIds(): string[] {
      const ids = new Set<string>()

      for (const path of Object.keys(courseMdGlob)) {
        const parts = path.split('/')
        const courseId = parts[parts.length - 2]
        ids.add(courseId)
      }
      return Array.from(ids)
    },

    getCourseMarkdown(courseId: string, lang: UiLang): MarkdownInstance<CourseFrontmatter> | null {
      for (const [path, entry] of Object.entries(courseMdGlob)) {
        const parts = path.replace(/\\/g, '/').split('/')
        const pathCourseId = parts[parts.length - 2]
        const pathLang = parts[parts.length - 1]?.replace('.md', '') ?? ''
        if (pathCourseId === courseId && pathLang === lang) return entry
      }

      if (lang !== 'en') {
        return this.getCourseMarkdown(courseId, 'en')
      }
      return null
    },

    getLessonIndex(): Map<string, Map<string, Set<string>>> {
      if (!lessonIndexCache) {
        lessonIndexCache = buildLessonIndex()
      }
      return lessonIndexCache
    },

    getCourseStructure(courseId: string): CourseStructure | undefined {
      const structurePath = Object.keys(structuresGlob).find((p) => p.includes(`/${courseId}/`))

      return structurePath ? structuresGlob[structurePath]?.courseStructure : undefined
    },

    getModuleEntries(): Array<{ moduleId: string; module: LocalModule }> {
      const out: Array<{ moduleId: string; module: LocalModule }> = []

      for (const path of Object.keys(modulesGlob)) {
        const parts = path.split('/')
        const moduleId = parts[parts.length - 2]
        out.push({ moduleId, module: modulesGlob[path].module })
      }

      return out
    },

    getModule(moduleId: string): LocalModule | undefined {
      const pathKey = Object.keys(modulesGlob).find((p) => p.endsWith(`/${moduleId}/module.ts`))

      return pathKey ? modulesGlob[pathKey].module : undefined
    }
  }
}
