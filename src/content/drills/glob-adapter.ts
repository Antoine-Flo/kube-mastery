import type { UiLang } from '../courses/types'
import type { DrillFile, DrillRuntimeEnvMeta } from './types'
import type { DrillIndexPort } from './port'
import { parseDrillFile } from './domain'

const enMarkdownGlob = import.meta.glob<string>(
  '../../courses/drills/*/en.md',
  { eager: true, query: '?raw', import: 'default' }
)

const frMarkdownGlob = import.meta.glob<string>(
  '../../courses/drills/*/fr.md',
  { eager: true, query: '?raw', import: 'default' }
)

const drillFsModuleGlob = import.meta.glob('../../courses/drills/*/fs.ts', {
  eager: false
})

const drillClusterYamlGlob = import.meta.glob(
  '../../courses/drills/*/cluster.yaml',
  {
    eager: false,
    query: '?raw',
    import: 'default'
  }
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
  const combinedPaths = Object.keys(enMarkdownGlob)
  const ids = new Set<string>()
  for (const path of combinedPaths) {
    const id = extractDrillId(path)
    if (id) {
      ids.add(id)
    }
  }
  return Array.from(ids).sort()
}

function getDrillFile(drillId: string, lang: UiLang): DrillFile | null {
  const markdownGlob = lang === 'fr' ? frMarkdownGlob : enMarkdownGlob
  const markdownKey = Object.keys(markdownGlob).find(
    (k) => extractDrillId(k) === drillId
  )
  if (markdownKey && markdownGlob[markdownKey]) {
    return parseDrillFile(markdownGlob[markdownKey])
  }

  if (lang === 'fr') {
    return getDrillFile(drillId, 'en')
  }

  return null
}

function getDrillRuntimeEnv(drillId: string): DrillRuntimeEnvMeta {
  const hasFsModule = Object.keys(drillFsModuleGlob).some(
    (k) => extractDrillId(k) === drillId
  )
  const hasClusterYaml = Object.keys(drillClusterYamlGlob).some(
    (k) => extractDrillId(k) === drillId
  )
  return {
    hasFsModule,
    hasClusterYaml
  }
}

export function createDrillGlobAdapter(): DrillIndexPort {
  return {
    getDrillIds,
    getDrillFile,
    getDrillRuntimeEnv
  }
}
