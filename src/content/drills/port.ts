import type { UiLang } from '../courses/types'
import type { DrillGroupMeta } from './types'

export interface DrillIndexPort {
  getGroupIds(): string[]
  getGroupMeta(groupId: string): DrillGroupMeta | undefined
  getDrillDirsByGroup(): Map<string, string[]>
  getDrillTitle(groupId: string, drillId: string, lang: UiLang): string
  getDrillDescription(
    groupId: string,
    drillId: string,
    lang: UiLang
  ): string | null
}

export interface DrillContentPort {
  getDrillContent(groupId: string, drillId: string, lang: UiLang): unknown
}

export type DrillGlobAdapter = DrillIndexPort & DrillContentPort
