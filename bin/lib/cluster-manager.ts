import { execSync } from 'child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_CLUSTER_CONFIG_PATH,
  type ClusterNodeRole
} from '../../src/core/cluster/clusterConfig'
import { ENVOY_GATEWAY_SYSTEM_NAMESPACES } from '../../src/core/gateway-api/envoy/bootstrap'
import {
  ENVOY_GATEWAY_DEPLOYMENT_NAME,
  ENVOY_GATEWAY_GATEWAY_CLASS_NAME,
  ENVOY_GATEWAY_INSTALL_MANIFEST_URL,
  ENVOY_GATEWAY_NAMESPACE,
  ENVOY_GATEWAY_QUICKSTART_MANIFEST_URL
} from '../../src/core/gateway-api/envoy/constants'
import { parseClusterNodeRolesFromKindConfig } from '../../src/core/cluster/clusterConfig'
import type { Result } from './types'
import { error, success } from './types'

const DEFAULT_KIND_CONFIG = DEFAULT_CLUSTER_CONFIG_PATH

export const ensureCluster = (
  name: string,
  kindConfigPath?: string
): Result<void, string> => {
  const ensureEnvoyGatewayInstalled = (): void => {
    const hasEnvoyGateway = (() => {
      try {
        const output = execSync(
          `kubectl get deployment ${ENVOY_GATEWAY_DEPLOYMENT_NAME} -n ${ENVOY_GATEWAY_NAMESPACE} -o name`,
          {
            stdio: 'pipe',
            encoding: 'utf-8'
          }
        ).trim()
        return output.length > 0
      } catch {
        return false
      }
    })()
    if (!hasEnvoyGateway) {
      execSync(
        `kubectl apply --server-side -f ${ENVOY_GATEWAY_INSTALL_MANIFEST_URL}`,
        { stdio: 'pipe', encoding: 'utf-8' }
      )
      execSync(
        `kubectl wait --timeout=180s -n ${ENVOY_GATEWAY_NAMESPACE} deployment/${ENVOY_GATEWAY_DEPLOYMENT_NAME} --for=condition=Available`,
        { stdio: 'pipe', encoding: 'utf-8' }
      )
    }
    const hasGatewayClass = (() => {
      try {
        const output = execSync(
          `kubectl get gatewayclass ${ENVOY_GATEWAY_GATEWAY_CLASS_NAME} -o name`,
          {
            stdio: 'pipe',
            encoding: 'utf-8'
          }
        ).trim()
        return output.length > 0
      } catch {
        return false
      }
    })()
    if (!hasGatewayClass) {
      execSync(
        `kubectl apply -f ${ENVOY_GATEWAY_QUICKSTART_MANIFEST_URL} -n default`,
        { stdio: 'pipe', encoding: 'utf-8' }
      )
    }
  }
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
      ensureEnvoyGatewayInstalled()
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
    ensureEnvoyGatewayInstalled()

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
  'local-path-storage',
  'ingress-nginx',
  ...ENVOY_GATEWAY_SYSTEM_NAMESPACES
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
  'events',
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

export const getSeedPath = (seedName: string): string => {
  return join(process.cwd(), 'src', 'courses', 'seeds', seedName)
}
