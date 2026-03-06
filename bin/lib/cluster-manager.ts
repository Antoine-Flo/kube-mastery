import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_CLUSTER_CONFIG_PATH,
  type ClusterNodeRole
} from '../../src/core/cluster/clusterConfig'
import { parseClusterNodeRolesFromKindConfig } from '../../src/core/cluster/clusterConfig'
import type { Result } from './types'
import { error, success } from './types'

const DEFAULT_KIND_CONFIG = DEFAULT_CLUSTER_CONFIG_PATH

export const ensureCluster = (
  name: string,
  kindConfigPath?: string
): Result<void, string> => {
  try {
    const existingClustersOutput = execSync('kind get clusters', {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    const existingClusters = existingClustersOutput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    if (existingClusters.includes(name)) {
      return success(undefined)
    }

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

const runBestEffortKubectlCommand = (command: string): void => {
  try {
    execSync(command, {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
  } catch {
    return
  }
}

const PROTECTED_NAMESPACES = new Set([
  'default',
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'local-path-storage'
])

const DEFAULT_NAMESPACE_CLEANUP_RESOURCES = [
  'pods',
  'deployments',
  'replicasets',
  'daemonsets',
  'statefulsets',
  'jobs',
  'cronjobs',
  'services',
  'configmaps',
  'secrets',
  'ingresses',
  'persistentvolumeclaims'
]

interface KubernetesListItem {
  metadata?: {
    name?: string
  }
  type?: string
}

const getListItemsForResource = (
  resource: string,
  namespace: string
): KubernetesListItem[] => {
  try {
    const output = execSync(`kubectl get ${resource} -n ${namespace} -o json`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    const payload = JSON.parse(output)
    const items = Array.isArray(payload?.items) ? payload.items : []
    return items as KubernetesListItem[]
  } catch {
    return []
  }
}

const shouldPreserveDefaultNamespaceResource = (
  resource: string,
  item: KubernetesListItem
): boolean => {
  const name = item?.metadata?.name ?? ''
  if (resource === 'services') {
    return name === 'kubernetes'
  }
  if (resource === 'configmaps') {
    return name === 'kube-root-ca.crt'
  }
  if (resource === 'secrets') {
    const type = item?.type ?? ''
    if (type === 'kubernetes.io/service-account-token') {
      return true
    }
    return name.startsWith('default-token-')
  }
  return false
}

const cleanupDefaultNamespaceResource = (resource: string): void => {
  const items = getListItemsForResource(resource, 'default')
  for (const item of items) {
    const name = item?.metadata?.name ?? ''
    if (name.length === 0) {
      continue
    }
    if (shouldPreserveDefaultNamespaceResource(resource, item)) {
      continue
    }
    runBestEffortKubectlCommand(
      `kubectl delete ${resource} ${name} -n default --ignore-not-found=true`
    )
  }
}

export const resetConformanceClusterState = (): Result<void, string> => {
  try {
    for (const resource of DEFAULT_NAMESPACE_CLEANUP_RESOURCES) {
      cleanupDefaultNamespaceResource(resource)
    }

    runBestEffortKubectlCommand(
      'kubectl delete persistentvolumes --all --ignore-not-found=true'
    )

    const namespacesOutput = execSync('kubectl get namespaces -o json', {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    const namespacesPayload = JSON.parse(namespacesOutput)
    const namespaceItems = Array.isArray(namespacesPayload.items)
      ? namespacesPayload.items
      : []

    for (const namespaceItem of namespaceItems) {
      const namespaceName =
        namespaceItem?.metadata?.name != null
          ? String(namespaceItem.metadata.name)
          : ''
      if (namespaceName.length === 0) {
        continue
      }
      if (PROTECTED_NAMESPACES.has(namespaceName)) {
        continue
      }
      runBestEffortKubectlCommand(
        `kubectl delete namespace ${namespaceName} --ignore-not-found=true --wait=true --timeout=60s`
      )
    }

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to reset conformance cluster state: ${message}`)
  }
}

export const ensureCurrentContextNamespace = (
  namespace: string
): Result<void, string> => {
  try {
    execSync(`kubectl config set-context --current --namespace=${namespace}`, {
      stdio: 'pipe',
      encoding: 'utf-8'
    })
    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(
      `Failed to set current context namespace to ${namespace}: ${message}`
    )
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
    const output = execSync(
      `kubectl ${action} -f ${yamlFile}${ignoreNotFoundArg}`,
      {
        stdio: 'pipe',
        encoding: 'utf-8'
      }
    ).trim()
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
          const containerStatuses = Array.isArray(
            pod?.status?.containerStatuses
          )
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

      const scope =
        namespace != null && namespace.length > 0
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
