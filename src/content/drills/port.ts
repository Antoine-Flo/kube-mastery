import type { UiLang } from '../courses/types'
import type { DrillFile, DrillRuntimeEnvMeta } from './types'

export interface DrillIndexPort {
  getDrillIds(): string[]
  getDrillFile(drillId: string, lang: UiLang): DrillFile | null
  getDrillRuntimeEnv(drillId: string): DrillRuntimeEnvMeta
}
