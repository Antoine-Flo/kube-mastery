import type { UiLang } from '../courses/types'
import type { DrillListItem, DrillDetail } from './types'
import type { DrillIndexPort } from './port'
import { buildDrillList, buildDrillDetail } from './domain'
import { createDrillGlobAdapter } from './glob-adapter'

export type { DrillListItem, DrillDetail, DrillTask, DrillValidation, DrillTagId } from './types'

let adapter: DrillIndexPort | null = null

function getAdapter(): DrillIndexPort {
  if (!adapter) {
    adapter = createDrillGlobAdapter()
  }
  return adapter
}

export function getDrills(lang: UiLang): DrillListItem[] {
  return buildDrillList(getAdapter(), lang)
}

export function getDrillDetail(drillId: string, lang: UiLang): DrillDetail | null {
  return buildDrillDetail(getAdapter(), drillId, lang)
}
