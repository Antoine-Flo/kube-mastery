import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_CLUSTER_CONFIG_PATH,
  type ClusterNodeRole
} from '../../src/config/clusterConfig'
import { parseClusterNodeRolesFromKindConfig } from '../../src/core/cluster/clusterConfig'
import type { Result } from './types'
import { error, success } from './types'

const DEFAULT_KIND_CONFIG = DEFAULT_CLUSTER_CONFIG_PATH

export const ensureCluster = (
  name: string,
  kindConfigPath?: string
): Result<void, string> => {
  try {
    const configPath =
      kindConfigPath ??
      (existsSync(join(process.cwd(), DEFAULT_KIND_CONFIG))
        ? DEFAULT_KIND_CONFIG
        : undefined)
    const configArg = configPath ? ` --config ${configPath}` : ''
    execSync(`kind create cluster --name ${name}${configArg}`, {
      stdio: 'inherit'
    })

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to create cluster ${name}: ${message}`)
  }
}

export const loadClusterNodeRoles = (
  kindConfigPath?: string
): Result<ClusterNodeRole[], string> => {
  const configPath = kindConfigPath ?? DEFAULT_KIND_CONFIG
  const absolutePath = join(process.cwd(), configPath)
  if (!existsSync(absolutePath)) {
    return error(`Kind config not found at ${configPath}`)
  }

  try {
    const yamlContent = readFileSync(absolutePath, 'utf-8')
    const roles = parseClusterNodeRolesFromKindConfig(yamlContent)
    return success(roles)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to parse cluster config ${configPath}: ${message}`)
  }
}

export const deleteCluster = (name: string): Result<void, string> => {
  try {
    execSync(`kind delete cluster --name ${name}`, { stdio: 'inherit' })
    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to delete cluster ${name}: ${message}`)
  }
}

export const listYamlFiles = (dir: string): string[] => {
  const yamlFiles: string[] = []
  const scan = (currentDir: string): void => {
    const entries = readdirSync(currentDir)

    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const stat = statSync(fullPath)
      if (stat.isDirectory()) {
        scan(fullPath)
      } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
        yamlFiles.push(fullPath)
      }
    }
  }

  scan(dir)
  return yamlFiles.sort()
}

const isYamlFile = (path: string): boolean => {
  return path.endsWith('.yaml') || path.endsWith('.yml')
}

const resolveYamlTargets = (targetPath: string): Result<string[], string> => {
  try {
    const stat = statSync(targetPath)
    if (stat.isDirectory()) {
      const files = listYamlFiles(targetPath)
      if (files.length === 0) {
        return error(`No YAML files found in ${targetPath}`)
      }
      return success(files)
    }
    if (!isYamlFile(targetPath)) {
      return error(`Target is not a YAML file: ${targetPath}`)
    }
    return success([targetPath])
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to resolve target path ${targetPath}: ${message}`)
  }
}

const runKubectlForYamlTargets = (
  action: 'apply' | 'delete',
  targetPath: string,
  ignoreNotFound?: boolean
): Result<string, string> => {
  const filesResult = resolveYamlTargets(targetPath)
  if (!filesResult.ok) {
    return filesResult
  }
  const outputs: string[] = []
  for (const yamlFile of filesResult.value) {
    const ignoreNotFoundArg =
      action === 'delete' && ignoreNotFound ? ' --ignore-not-found' : ''
    const output = execSync(`kubectl ${action} -f ${yamlFile}${ignoreNotFoundArg}`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    }).trim()
    outputs.push(output)
  }
  return success(outputs.filter((line) => line.length > 0).join('\n'))
}

export const applyYamlTarget = (targetPath: string): Result<string, string> => {
  try {
    return runKubectlForYamlTargets('apply', targetPath)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to apply YAML target ${targetPath}: ${message}`)
  }
}

export const deleteYamlTarget = (
  targetPath: string,
  ignoreNotFound = true
): Result<string, string> => {
  try {
    return runKubectlForYamlTargets('delete', targetPath, ignoreNotFound)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to delete YAML target ${targetPath}: ${message}`)
  }
}

export const waitForPodsReady = (namespace?: string): Result<void, string> => {
  try {
    const nsFlag = namespace ? `-n ${namespace}` : '--all-namespaces'
    const timeout = '60s'
    const waitCommand = `kubectl wait --for=condition=Ready pod --all ${nsFlag} --timeout=${timeout}`

    try {
      execSync(waitCommand, { stdio: 'pipe' })
      return success(undefined)
    } catch {
      const output = execSync(`kubectl get pods ${nsFlag} -o json`, {
        encoding: 'utf-8'
      })
      const pods = JSON.parse(output)
      const items = Array.isArray(pods.items) ? pods.items : []
      const notReadyPods = items
        .filter((pod: any) => {
          const phase = pod?.status?.phase
          if (phase === 'Succeeded') {
            return false
          }
          const containerStatuses = Array.isArray(pod?.status?.containerStatuses)
            ? pod.status.containerStatuses
            : []
          if (containerStatuses.length === 0) {
            return true
          }
          const allReady = containerStatuses.every((status: any) => {
            return status?.ready === true
          })
          return !allReady
        })
        .map((pod: any) => {
          const podNamespace = pod?.metadata?.namespace ?? 'default'
          const podName = pod?.metadata?.name ?? 'unknown'
          const phase = pod?.status?.phase ?? 'Unknown'
          return `${podNamespace}/${podName}:${phase}`
        })

      const scope = namespace != null && namespace.length > 0
        ? `namespace "${namespace}"`
        : 'all namespaces'
      const renderedPods = notReadyPods.slice(0, 12).join(', ')
      const hasMore = notReadyPods.length > 12
      const suffix = hasMore ? ', ...' : ''
      const details = renderedPods.length > 0 ? renderedPods : '<none>'
      return error(
        `Timed out waiting for pods to become Ready in ${scope}. Not ready: ${details}${suffix}`
      )
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to wait for pods: ${message}`)
  }
}

export const getSeedPath = (seedName: string): string => {
  return join(process.cwd(), 'src', 'courses', 'seeds', seedName)
}
