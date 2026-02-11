import type { MarkdownInstance } from 'astro'
import type { UiLang } from '../courses/types'
import type { TaskGroupMeta } from './types'
import type { TaskGlobAdapter } from './port'
import { stripNumericPrefix, parseH1 } from '../utils'

const groupGlob = import.meta.glob<{ group: TaskGroupMeta }>('../../courses/tasks/*/group.ts', {
  eager: true
})

const contentRawGlob = import.meta.glob<string>('../../courses/tasks/*/*/en/content.md', {
  eager: true,
  query: '?raw',
  import: 'default'
})

const contentFrRawGlob = import.meta.glob<string>('../../courses/tasks/*/*/fr/content.md', {
  eager: true,
  query: '?raw',
  import: 'default'
})

const contentAsMarkdownGlob = import.meta.glob<MarkdownInstance<Record<string, unknown>>>(
  '../../courses/tasks/*/*/*/content.md',
  { eager: true }
)

const contentMdKeys = Object.keys(contentAsMarkdownGlob)

function getGroupIds(): string[] {
  const ids: string[] = []

  for (const path of Object.keys(groupGlob)) {
    const parts = path.split('/')
    const tasksIdx = parts.indexOf('tasks')
    if (tasksIdx === -1 || parts.length < tasksIdx + 2) {
      continue
    }
    ids.push(parts[tasksIdx + 1])
  }

  return ids.sort()
}

function getGroupMeta(groupId: string): TaskGroupMeta | undefined {
  const pathKey = Object.keys(groupGlob).find((p) => p.endsWith(`/${groupId}/group.ts`))
  if (!pathKey) {
    return undefined
  }
  const mod = groupGlob[pathKey] as { group?: TaskGroupMeta } | undefined
  return mod?.group
}

function getTaskDirsByGroup(): Map<string, string[]> {
  const seen = new Map<string, Set<string>>()

  for (const path of contentMdKeys) {
    const parts = path.split('/')
    const tasksIdx = parts.indexOf('tasks')
    if (tasksIdx === -1 || parts.length < tasksIdx + 4) {
      continue
    }
    const groupId = parts[tasksIdx + 1]
    const taskDir = parts[tasksIdx + 2]
    if (!seen.has(groupId)) {
      seen.set(groupId, new Set())
    }
    seen.get(groupId)!.add(taskDir)
  }

  const out = new Map<string, string[]>()
  for (const [groupId, set] of seen) {
    out.set(groupId, Array.from(set).sort())
  }
  return out
}

function getTaskTitle(groupId: string, taskId: string, lang: UiLang): string {
  const rawGlob = lang === 'fr' ? contentFrRawGlob : contentRawGlob
  const suffix = `tasks/${groupId}/${taskId.replace(/^\d+-/, '')}/${lang}/content.md`
  const prefix = `tasks/${groupId}/`
  const foundKey = Object.keys(rawGlob).find((k) => {
    const normalized = k.replace(/\\/g, '/')
    if (!normalized.includes(prefix)) {
      return false
    }
    const afterGroup = normalized.split(prefix)[1]
    if (!afterGroup) {
      return false
    }
    const taskDir = afterGroup.split('/')[0]
    const taskIdNorm = stripNumericPrefix(taskDir)
    return taskIdNorm === taskId && afterGroup.endsWith(`/${lang}/content.md`)
  })
  if (!foundKey) {
    const fallbackKey = Object.keys(rawGlob).find(
      (k) => k.includes(`tasks/${groupId}/`) && k.includes(`/${lang}/content.md`)
    )
    if (!fallbackKey) {
      return taskId
    }
    const raw = rawGlob[fallbackKey]
    return parseH1(raw ?? '')
  }
  const raw = rawGlob[foundKey]
  return parseH1(raw ?? '') || taskId
}

function contentPath(groupId: string, taskDir: string, lang: UiLang): string {
  return `tasks/${groupId}/${taskDir}/${lang}/content.md`
}

function getTaskContent(
  groupId: string,
  taskId: string,
  lang: UiLang
): MarkdownInstance<Record<string, unknown>> | null {
  const taskDirs = getTaskDirsByGroup().get(groupId)
  if (!taskDirs) {
    return null
  }
  const taskDir = taskDirs.find((d) => stripNumericPrefix(d) === taskId)
  if (!taskDir) {
    return null
  }
  const suffix = contentPath(groupId, taskDir, lang)
  const found = Object.keys(contentAsMarkdownGlob).find((k) => k.replace(/\\/g, '/').endsWith(suffix))
  if (!found) {
    return null
  }
  const entry = contentAsMarkdownGlob[found]
  return entry ?? null
}

function getTaskDescription(groupId: string, taskId: string, lang: UiLang): string | null {
  const entry = getTaskContent(groupId, taskId, lang)
  if (!entry?.frontmatter?.description) {
    return null
  }
  const d = entry.frontmatter.description
  return typeof d === 'string' ? d : null
}

export function createTaskGlobAdapter(): TaskGlobAdapter {
  const taskDirsByGroup = getTaskDirsByGroup()

  return {
    getGroupIds,
    getGroupMeta,
    getTaskDirsByGroup: () => taskDirsByGroup,
    getTaskTitle(groupId, taskId, lang) {
      const dirs = taskDirsByGroup.get(groupId) ?? []
      const taskDir = dirs.find((d) => stripNumericPrefix(d) === taskId)
      if (!taskDir) {
        return taskId
      }
      const suffix = `tasks/${groupId}/${taskDir}/${lang}/content.md`
      const foundKey = Object.keys(contentRawGlob).find((k) => k.replace(/\\/g, '/').endsWith(suffix))
      if (foundKey && contentRawGlob[foundKey]) {
        return parseH1(contentRawGlob[foundKey] ?? '') || taskId
      }
      const foundFr = Object.keys(contentFrRawGlob).find((k) => k.replace(/\\/g, '/').endsWith(suffix))
      if (foundFr && contentFrRawGlob[foundFr] && lang === 'fr') {
        return parseH1(contentFrRawGlob[foundFr] ?? '') || taskId
      }
      return taskId
    },
    getTaskContent,
    getTaskDescription
  }
}
