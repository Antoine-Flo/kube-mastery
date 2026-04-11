import type { UiLang } from '../courses/types'
import type { DrillFile } from './types'
import type { DrillIndexPort } from './port'
import { parseDrillFile } from './domain'

const enRawGlob = import.meta.glob<string>(
  '../../courses/drills/*/en.yaml',
  { eager: true, query: '?raw', import: 'default' }
)

const frRawGlob = import.meta.glob<string>(
  '../../courses/drills/*/fr.yaml',
  { eager: true, query: '?raw', import: 'default' }
)

function extractDrillId(path: string): string | null {
  const parts = path.split('/')
  const drillsIdx = parts.indexOf('drills')
  if (drillsIdx === -1 || parts.length < drillsIdx + 2) {
    return null
  }
  return parts[drillsIdx + 1]
}

function getDrillIds(): string[] {
  return Object.keys(enRawGlob)
    .map(extractDrillId)
    .filter((id): id is string => id !== null)
    .sort()
}

function getDrillFile(drillId: string, lang: UiLang): DrillFile | null {
  const glob = lang === 'fr' ? frRawGlob : enRawGlob
  const foundKey = Object.keys(glob).find((k) => extractDrillId(k) === drillId)

  if (foundKey && glob[foundKey]) {
    return parseDrillFile(glob[foundKey])
  }

  if (lang === 'fr') {
    return getDrillFile(drillId, 'en')
  }

  return null
}

export function createDrillGlobAdapter(): DrillIndexPort {
  return {
    getDrillIds,
    getDrillFile
  }
}
