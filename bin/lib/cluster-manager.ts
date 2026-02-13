import { execSync } from 'child_process'
import { existsSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import type { Result } from './types'
import { error, success } from './types'

const DEFAULT_KIND_CONFIG = 'kind/configs/multi-node.yaml'

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

    try {
      execSync(
        `kubectl wait --for=condition=Ready pod --all ${nsFlag} --timeout=${timeout}`,
        { stdio: 'pipe' }
      )
    } catch {
      const output = execSync(`kubectl get pods ${nsFlag} -o json`, {
        encoding: 'utf-8'
      })

      const pods = JSON.parse(output)
      const readyPods =
        pods.items?.filter(
          (p: any) =>
            p.status?.phase === 'Running' || p.status?.phase === 'Succeeded'
        ) || []
      if (readyPods.length === 0) {
        return error('No pods are ready')
      }
    }

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to wait for pods: ${message}`)
  }
}

export const getSeedPath = (seedName: string): string => {
  return join(process.cwd(), 'src', 'courses', 'seeds', seedName)
}
