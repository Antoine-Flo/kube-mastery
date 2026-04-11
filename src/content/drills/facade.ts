import type { MarkdownInstance } from 'astro'
import type { UiLang } from '../courses/types'
import type { DrillGroupOverview, DrillGroupListItem } from './types'
import type { DrillGlobAdapter } from './port'
import { buildDrillGroupOverview, buildDrillGroupList } from './domain'
import { createDrillGlobAdapter } from './glob-adapter'
import { DEMO_DRILL_GROUP_ID } from './constants'

let adapter: DrillGlobAdapter | null = null

function getAdapter(): DrillGlobAdapter {
  if (!adapter) {
    adapter = createDrillGlobAdapter()
  }
  return adapter
}

export type {
  DrillGroupOverview,
  DrillGroupListItem,
  DrillLocation,
  DrillOverview
} from './types'

export function getDrillGroups(lang: UiLang): DrillGroupListItem[] {
  return buildDrillGroupList(getAdapter(), lang).filter(
    (g) => g.id !== DEMO_DRILL_GROUP_ID
  )
}

export function getDrillGroupOverview(
  groupId: string,
  lang: UiLang
): DrillGroupOverview | null {
  return buildDrillGroupOverview(getAdapter(), groupId, lang)
}

export function getDrillContent(
  groupId: string,
  drillId: string,
  lang: UiLang
): MarkdownInstance<Record<string, unknown>> | null {
  const content = getAdapter().getDrillContent(groupId, drillId, lang)
  if (!content) {
    return null
  }
  return content as MarkdownInstance<Record<string, unknown>>
}
