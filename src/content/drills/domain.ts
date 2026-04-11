import type { UiLang } from '../courses/types'
import type { DrillGroupOverview, DrillGroupListItem } from './types'
import type { DrillIndexPort } from './port'
import { stripNumericPrefix } from '../utils'

export function buildDrillGroupOverview(
  port: DrillIndexPort,
  groupId: string,
  lang: UiLang
): DrillGroupOverview | null {
  const meta = port.getGroupMeta(groupId)
  if (!meta) {
    return null
  }

  const drillDirs = port.getDrillDirsByGroup().get(groupId)
  if (!drillDirs || drillDirs.length === 0) {
    return null
  }

  const drills = drillDirs.map((drillDir) => {
    const id = stripNumericPrefix(drillDir)
    const title = port.getDrillTitle(groupId, id, lang)
    const description = port.getDrillDescription(groupId, id, lang)
    return { id, title, description }
  })

  const title = meta.title[lang] ?? meta.title.en
  const description = meta.description?.[lang] ?? meta.description?.en ?? null

  return {
    id: groupId,
    title,
    description,
    drills,
    environment: meta.environment,
    ckaTargetMinutes: meta.ckaTargetMinutes
  }
}

export function buildDrillGroupList(
  port: DrillIndexPort,
  lang: UiLang
): DrillGroupListItem[] {
  const groupIds = port.getGroupIds()
  const list: DrillGroupListItem[] = []

  for (const groupId of groupIds) {
    const meta = port.getGroupMeta(groupId)
    if (!meta) {
      continue
    }

    const drillDirs = port.getDrillDirsByGroup().get(groupId)
    const totalDrills = drillDirs?.length ?? 0
    if (totalDrills === 0) {
      continue
    }

    const title = meta.title[lang] ?? meta.title.en
    const description = meta.description?.[lang] ?? meta.description?.en ?? null

    list.push({
      id: groupId,
      title,
      description,
      totalDrills
    })
  }

  return list
}
