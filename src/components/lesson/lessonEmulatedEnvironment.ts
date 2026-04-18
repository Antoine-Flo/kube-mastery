/**
 * Bundled behind a dynamic import from the lesson layout script so the initial
 * layout chunk does not pull the full emulator + seeds into the critical path.
 */
import {
  createEmulatedEnvironment,
  destroyEmulatedEnvironment
} from '../../core/emulatedEnvironment/EmulatedEnvironmentManager'
import { getSeed } from '../../courses/seeds/getSeed'
import { createFilesystemFromConfig } from '../../core/filesystem/debianFileSystem'
import { applyResourceWithEvents } from '../../core/kubectl/commands/resourceCatalog'
import { parseKubernetesYaml } from '../../core/kubectl/yamlParser'
import { splitYamlDocuments } from '../../core/cluster/seeds/yamlDocuments'
import type { EmulatedEnvironment } from '../../core/emulatedEnvironment/EmulatedEnvironment'
import type { FsConfig } from '../../core/filesystem/debianFileSystem'

export { destroyEmulatedEnvironment }

const drillFsConfigGlob = import.meta.glob<FsConfig>(
  '../../courses/drills/*/fs.ts',
  {
    eager: true,
    import: 'fsConfig'
  }
)

const drillClusterYamlGlob = import.meta.glob<string>(
  '../../courses/drills/*/cluster.yaml',
  {
    eager: true,
    query: '?raw',
    import: 'default'
  }
)

export interface LessonEnvironmentOptions {
  seedName: string
  drillId?: string
  hasFsModule?: boolean
  hasClusterYaml?: boolean
}

const getDrillFsConfig = (
  drillId: string | undefined,
  hasFsModule: boolean | undefined
): FsConfig | null => {
  if (!drillId || !hasFsModule) {
    return null
  }
  const modulePath = `../../courses/drills/${drillId}/fs.ts`
  const fsConfig = drillFsConfigGlob[modulePath]
  if (!fsConfig) {
    return null
  }
  return fsConfig
}

const getDrillClusterYaml = (
  drillId: string | undefined,
  hasClusterYaml: boolean | undefined
): string | null => {
  if (!drillId || !hasClusterYaml) {
    return null
  }
  const yamlPath = `../../courses/drills/${drillId}/cluster.yaml`
  const yamlContent = drillClusterYamlGlob[yamlPath]
  if (!yamlContent) {
    return null
  }
  return yamlContent
}

const applyClusterYamlToEnvironment = (
  environment: EmulatedEnvironment,
  yamlContent: string
): void => {
  const documents = splitYamlDocuments(yamlContent)
  for (const documentContent of documents) {
    const parsed = parseKubernetesYaml(documentContent.trim())
    if (!parsed.ok) {
      continue
    }
    const applyResult = applyResourceWithEvents(parsed.value, environment.apiServer)
    if (!applyResult.ok) {
      console.error('[DrillEnv] Failed to apply cluster seed resource', {
        error: applyResult.error
      })
    }
  }
}

export function createLessonEmulatedEnvironment(
  options: LessonEnvironmentOptions
): EmulatedEnvironment {
  const drillFsConfig = getDrillFsConfig(options.drillId, options.hasFsModule)
  const seed = getSeed(options.seedName)
  const fsConfig = drillFsConfig ?? seed.fsConfig
  const environment = createEmulatedEnvironment({
    filesystemState: createFilesystemFromConfig(fsConfig ?? {})
  })
  const clusterYamlContent = getDrillClusterYaml(
    options.drillId,
    options.hasClusterYaml
  )
  if (clusterYamlContent) {
    applyClusterYamlToEnvironment(environment, clusterYamlContent)
  }
  return environment
}
