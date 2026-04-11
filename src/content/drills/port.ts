import type { UiLang } from '../courses/types'
import type { DrillFile } from './types'

export interface DrillIndexPort {
  getDrillIds(): string[]
  getDrillFile(drillId: string, lang: UiLang): DrillFile | null
}
