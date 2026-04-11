import type { MarkdownInstance } from 'astro'
import type { UiLang } from '../courses/types'
import type { DrillGroupMeta } from './types'
import type { DrillGlobAdapter } from './port'
import { stripNumericPrefix, parseH1 } from '../utils'

const groupGlob = import.meta.glob<{ group: DrillGroupMeta }>(
  '../../courses/drills/*/group.ts',
  {
    eager: true
  }
)

const contentRawGlob = import.meta.glob<string>(
  '../../courses/drills/*/*/en/content.md',
  {
    eager: true,
    query: '?raw',
    import: 'default'
  }
)

const contentFrRawGlob = import.meta.glob<string>(
  '../../courses/drills/*/*/fr/content.md',
  {
    eager: true,
    query: '?raw',
    import: 'default'
  }
)

const contentAsMarkdownGlob = import.meta.glob<
  MarkdownInstance<Record<string, unknown>>
>('../../courses/drills/*/*/*/content.md', { eager: true })

const contentMdKeys = Object.keys(contentAsMarkdownGlob)

function getGroupIds(): string[] {
  const ids: string[] = []

  for (const path of Object.keys(groupGlob)) {
    const parts = path.split('/')
    const drillsIdx = parts.indexOf('drills')
    if (drillsIdx === -1 || parts.length < drillsIdx + 2) {
      continue
    }
    ids.push(parts[drillsIdx + 1])
  }

  return ids.sort()
}

function getGroupMeta(groupId: string): DrillGroupMeta | undefined {
  const pathKey = Object.keys(groupGlob).find((p) =>
    p.endsWith(`/${groupId}/group.ts`)
  )
  if (!pathKey) {
    return undefined
  }
  const mod = groupGlob[pathKey] as { group?: DrillGroupMeta } | undefined
  return mod?.group
}

function getDrillDirsByGroup(): Map<string, string[]> {
  const seen = new Map<string, Set<string>>()

  for (const path of contentMdKeys) {
    const parts = path.split('/')
    const drillsIdx = parts.indexOf('drills')
    if (drillsIdx === -1 || parts.length < drillsIdx + 4) {
      continue
    }
    const groupId = parts[drillsIdx + 1]
    const drillDir = parts[drillsIdx + 2]
    if (!seen.has(groupId)) {
      seen.set(groupId, new Set())
    }
    seen.get(groupId)!.add(drillDir)
  }

  const out = new Map<string, string[]>()
  for (const [groupId, set] of seen) {
    out.set(groupId, Array.from(set).sort())
  }
  return out
}

function contentPath(groupId: string, drillDir: string, lang: UiLang): string {
  return `drills/${groupId}/${drillDir}/${lang}/content.md`
}

function getDrillContent(
  groupId: string,
  drillId: string,
  lang: UiLang
): MarkdownInstance<Record<string, unknown>> | null {
  const drillDirs = getDrillDirsByGroup().get(groupId)
  if (!drillDirs) {
    return null
  }
  const drillDir = drillDirs.find((d) => stripNumericPrefix(d) === drillId)
  if (!drillDir) {
    return null
  }
  const suffix = contentPath(groupId, drillDir, lang)
  const found = Object.keys(contentAsMarkdownGlob).find((k) =>
    k.replace(/\\/g, '/').endsWith(suffix)
  )
  if (!found) {
    return null
  }
  const entry = contentAsMarkdownGlob[found]
  return entry ?? null
}

function getDrillDescription(
  groupId: string,
  drillId: string,
  lang: UiLang
): string | null {
  const entry = getDrillContent(groupId, drillId, lang)
  if (!entry?.frontmatter?.description) {
    return null
  }
  const d = entry.frontmatter.description
  return typeof d === 'string' ? d : null
}

export function createDrillGlobAdapter(): DrillGlobAdapter {
  const drillDirsByGroup = getDrillDirsByGroup()

  return {
    getGroupIds,
    getGroupMeta,
    getDrillDirsByGroup: () => drillDirsByGroup,
    getDrillTitle(groupId, drillId, lang) {
      const dirs = drillDirsByGroup.get(groupId) ?? []
      const drillDir = dirs.find((d) => stripNumericPrefix(d) === drillId)
      if (!drillDir) {
        return drillId
      }
      const suffix = `drills/${groupId}/${drillDir}/${lang}/content.md`
      const foundKey = Object.keys(contentRawGlob).find((k) =>
        k.replace(/\\/g, '/').endsWith(suffix)
      )
      if (foundKey && contentRawGlob[foundKey]) {
        return parseH1(contentRawGlob[foundKey] ?? '') || drillId
      }
      const foundFr = Object.keys(contentFrRawGlob).find((k) =>
        k.replace(/\\/g, '/').endsWith(suffix)
      )
      if (foundFr && contentFrRawGlob[foundFr] && lang === 'fr') {
        return parseH1(contentFrRawGlob[foundFr] ?? '') || drillId
      }
      return drillId
    },
    getDrillContent,
    getDrillDescription
  }
}
