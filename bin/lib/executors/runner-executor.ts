import { readFileSync, statSync } from 'fs'
import { basename } from 'path'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { DEFAULT_KIND_LIKE_BOOTSTRAP } from '../../../src/core/cluster/systemBootstrap'
import { parseKubernetesYaml } from '../../../src/core/kubectl/yamlParser'
import { createKubectlExecutor } from '../../../src/core/kubectl/commands/executor'
import { createFileSystem } from '../../../src/core/filesystem/FileSystem'
import { createDirectory } from '../../../src/core/filesystem/models/Directory'
import { createFile } from '../../../src/core/filesystem/models/File'
import { createLogger } from '../../../src/logger/Logger'
import { listYamlFiles } from '../cluster-manager'
import type {
  ApplyYamlAction,
  CommandExecutionResult,
  DeleteYamlAction,
  WaitPodsReadyAction
} from '../conformance-types'

interface ParsedManifestResource {
  kind: string
  metadata: {
    name: string
    namespace?: string
  }
}

export interface RunnerExecutor {
  executeCommand: (command: string) => CommandExecutionResult
  applyYaml: (action: ApplyYamlAction) => CommandExecutionResult
  deleteYaml: (action: DeleteYamlAction) => CommandExecutionResult
  waitPodsReady: (action: WaitPodsReadyAction) => CommandExecutionResult
}

const splitYamlDocuments = (yamlContent: string): string[] => {
  const documents = yamlContent.split(/^---\s*$/m)
  return documents.filter((doc) => doc.trim().length > 0)
}

const resolveYamlFiles = (targetPath: string): string[] => {
  const stat = statSync(targetPath)
  if (stat.isDirectory()) {
    return listYamlFiles(targetPath)
  }
  return [targetPath]
}

const parseResourcesFromPath = (targetPath: string): ParsedManifestResource[] => {
  const files = resolveYamlFiles(targetPath)
  const resources: ParsedManifestResource[] = []
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8')
    const documents = splitYamlDocuments(content)
    for (const document of documents) {
      const parsed = parseKubernetesYaml(document.trim())
      if (!parsed.ok) {
        continue
      }
      resources.push({
        kind: parsed.value.kind,
        metadata: parsed.value.metadata
      })
    }
  }
  return resources
}

const buildDeleteCommand = (resource: ParsedManifestResource): string | undefined => {
  const namespace = resource.metadata.namespace || 'default'
  const name = resource.metadata.name
  if (resource.kind === 'Pod') {
    return `kubectl delete pods ${name} -n ${namespace}`
  }
  if (resource.kind === 'ConfigMap') {
    return `kubectl delete configmaps ${name} -n ${namespace}`
  }
  if (resource.kind === 'Secret') {
    return `kubectl delete secrets ${name} -n ${namespace}`
  }
  if (resource.kind === 'ReplicaSet') {
    return `kubectl delete replicasets ${name} -n ${namespace}`
  }
  if (resource.kind === 'Deployment') {
    return `kubectl delete deployments ${name} -n ${namespace}`
  }
  if (resource.kind === 'Service') {
    return `kubectl delete services ${name} -n ${namespace}`
  }
  return undefined
}

const createSingleFileSystem = (filePath: string) => {
  const root = createDirectory('root', '/')
  const filename = basename(filePath)
  const content = readFileSync(filePath, 'utf-8')
  root.children.set(filename, createFile(filename, `/${filename}`, content))
  return createFileSystem({
    currentPath: '/',
    tree: root
  })
}

const executionFromOutput = (
  command: string,
  exitCode: number,
  stdout: string,
  stderr: string
): CommandExecutionResult => {
  const combined = stdout && stderr ? `${stdout}\n${stderr}` : stdout || stderr
  return {
    command,
    exitCode,
    stdout,
    stderr,
    combined
  }
}

export const createRunnerExecutor = (clusterName = 'conformance'): RunnerExecutor => {
  const logger = createLogger({ mirrorToConsole: false })
  const eventBus = createEventBus()
  const clusterState = createClusterState(eventBus, {
    bootstrap: {
      ...DEFAULT_KIND_LIKE_BOOTSTRAP,
      clusterName
    }
  })
  const fileSystem = createFileSystem()
  const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)

  return {
    executeCommand(command: string): CommandExecutionResult {
      const result = executor.execute(command)
      if (result.ok) {
        const value = result.value ?? ''
        return executionFromOutput(command, 0, value, '')
      }
      return executionFromOutput(command, 1, '', result.error)
    },
    applyYaml(action: ApplyYamlAction): CommandExecutionResult {
      try {
        const files = resolveYamlFiles(action.targetPath)
        const outputs: string[] = []
        for (const filePath of files) {
          const fs = createSingleFileSystem(filePath)
          const command = `kubectl apply -f /${basename(filePath)}`
          const result = executor.execute(command, fs)
          if (!result.ok) {
            return executionFromOutput(
              `kubectl apply -f ${action.targetPath}`,
              1,
              '',
              result.error
            )
          }
          outputs.push(result.value ?? '')
        }
        return executionFromOutput(
          `kubectl apply -f ${action.targetPath}`,
          0,
          outputs.filter((line) => line.length > 0).join('\n'),
          ''
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return executionFromOutput(
          `kubectl apply -f ${action.targetPath}`,
          1,
          '',
          message
        )
      }
    },
    deleteYaml(action: DeleteYamlAction): CommandExecutionResult {
      try {
        const resources = parseResourcesFromPath(action.targetPath)
        const outputs: string[] = []
        for (const resource of resources) {
          const deleteCommand = buildDeleteCommand(resource)
          if (deleteCommand === undefined) {
            continue
          }
          const result = executor.execute(deleteCommand)
          if (!result.ok) {
            if (action.ignoreNotFound && result.error.includes('not found')) {
              continue
            }
            return executionFromOutput(
              `kubectl delete -f ${action.targetPath}`,
              1,
              '',
              result.error
            )
          }
          outputs.push(result.value ?? '')
        }
        return executionFromOutput(
          `kubectl delete -f ${action.targetPath}`,
          0,
          outputs.filter((line) => line.length > 0).join('\n'),
          ''
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return executionFromOutput(
          `kubectl delete -f ${action.targetPath}`,
          1,
          '',
          message
        )
      }
    },
    waitPodsReady(_action: WaitPodsReadyAction): CommandExecutionResult {
      return executionFromOutput('runner wait pods ready', 0, 'pods ready', '')
    }
  }
}
