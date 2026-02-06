// ═══════════════════════════════════════════════════════════════════════════
// CLUSTER MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Manage kind clusters: create, delete, switch context, apply YAML files

import { execSync } from 'child_process'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import type { Result } from '../utils/types'
import { error, success } from '../utils/types'

// ─── Cluster Operations ────────────────────────────────────────────────────

/**
 * Check if a kind cluster exists
 */
const clusterExists = (name: string): boolean => {
  try {
    const output = execSync(`kind get clusters`, { encoding: 'utf-8', stdio: 'pipe' })
    return output.split('\n').some((line) => line.trim() === name)
  } catch {
    return false
  }
}

/**
 * Ensure a kind cluster exists, create it if it doesn't
 */
export const ensureCluster = (name: string): Result<void, string> => {
  try {
    if (clusterExists(name)) {
      return success(undefined)
    }

    console.log(`  Creating kind cluster: ${name}...`)
    execSync(`kind create cluster --name ${name}`, { stdio: 'inherit' })
    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to create cluster ${name}: ${message}`)
  }
}

/**
 * Get all kind clusters
 */
export const getAllClusters = (): Result<string[], string> => {
  try {
    const output = execSync(`kind get clusters`, { encoding: 'utf-8', stdio: 'pipe' })
    const clusters = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
    return success(clusters)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to list clusters: ${message}`)
  }
}

/**
 * Delete a kind cluster
 */
export const deleteCluster = (name: string): Result<void, string> => {
  try {
    if (!clusterExists(name)) {
      return success(undefined) // Already deleted
    }

    console.log(`  Deleting kind cluster: ${name}...`)
    execSync(`kind delete cluster --name ${name}`, { stdio: 'inherit' })
    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to delete cluster ${name}: ${message}`)
  }
}

/**
 * Delete all kind clusters
 */
export const deleteAllClusters = (): Result<void, string> => {
  try {
    const clustersResult = getAllClusters()
    if (!clustersResult.ok) {
      return clustersResult
    }

    const clusters = clustersResult.value
    if (clusters.length === 0) {
      console.log('  No clusters to delete')
      return success(undefined)
    }

    console.log(`  Deleting ${clusters.length} cluster(s)...`)
    for (const clusterName of clusters) {
      const deleteResult = deleteCluster(clusterName)
      if (!deleteResult.ok) {
        console.warn(`  ⚠ Warning: ${deleteResult.error}`)
      }
    }

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to delete all clusters: ${message}`)
  }
}

/**
 * Switch kubectl context to a kind cluster
 */
export const switchContext = (clusterName: string): Result<void, string> => {
  try {
    const contextName = `kind-${clusterName}`
    execSync(`kubectl config use-context ${contextName}`, { stdio: 'pipe' })
    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to switch context to ${clusterName}: ${message}`)
  }
}

// ─── YAML File Operations ───────────────────────────────────────────────────

/**
 * Find all YAML files in a directory (recursively)
 */
const findYamlFiles = (dir: string): string[] => {
  const yamlFiles: string[] = []

  const scan = (currentDir: string): void => {
    try {
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
    } catch (err) {
      // Ignore errors (directory might not exist)
    }
  }

  scan(dir)
  return yamlFiles.sort()
}

/**
 * Ensure namespace exists
 */
const ensureNamespace = (namespace: string): Result<void, string> => {
  try {
    // Check if namespace exists
    try {
      execSync(`kubectl get namespace ${namespace}`, { stdio: 'pipe' })
      // Already exists
      return success(undefined)
    } catch {
      // Doesn't exist, create it
      execSync(`kubectl create namespace ${namespace}`, { stdio: 'pipe' })
      return success(undefined)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to ensure namespace ${namespace}: ${message}`)
  }
}

/**
 * Ensure default service account exists in a namespace
 * Kind clusters don't create it automatically
 */
const ensureServiceAccount = (namespace: string = 'default'): Result<void, string> => {
  try {
    // First ensure namespace exists
    const nsResult = ensureNamespace(namespace)
    if (!nsResult.ok && namespace !== 'default' && namespace !== 'kube-system') {
      // Only fail for non-system namespaces
      return nsResult
    }

    // Check if service account exists
    try {
      execSync(`kubectl get serviceaccount default -n ${namespace}`, { stdio: 'pipe' })
      // Already exists, nothing to do
      return success(undefined)
    } catch {
      // Doesn't exist, create it
      execSync(`kubectl create serviceaccount default -n ${namespace}`, { stdio: 'pipe' })
      return success(undefined)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to ensure service account in ${namespace}: ${message}`)
  }
}

/**
 * Apply all YAML files from a seed directory to the cluster
 */
export const applyYamlFiles = (seedDir: string): Result<void, string> => {
  try {
    const yamlFiles = findYamlFiles(seedDir)

    if (yamlFiles.length === 0) {
      return error(`No YAML files found in ${seedDir}`)
    }

    console.log(`  Applying ${yamlFiles.length} YAML file(s) from ${seedDir}...`)

    // Ensure service accounts exist in namespaces that will be used
    // Extract namespaces from YAML files (simple approach: check for namespace: in YAML)
    const namespaces = new Set<string>(['default'])
    for (const yamlFile of yamlFiles) {
      try {
        const content = readFileSync(yamlFile, 'utf-8')
        // Match namespace: in YAML (handle both single and multi-document)
        const namespaceMatches = content.matchAll(/namespace:\s*(\S+)/g)
        for (const match of namespaceMatches) {
          if (match[1]) {
            namespaces.add(match[1])
          }
        }
      } catch {
        // Ignore errors reading files
      }
    }

    // Create service accounts for all namespaces
    for (const namespace of namespaces) {
      const saResult = ensureServiceAccount(namespace)
      if (!saResult.ok) {
        console.warn(`  ⚠ Warning: ${saResult.error}`)
      }
    }

    // Apply YAML files
    for (const yamlFile of yamlFiles) {
      try {
        execSync(`kubectl apply -f ${yamlFile}`, { stdio: 'pipe' })
      } catch (err) {
        // Some resources might fail (e.g., pods in error state), continue anyway
        const message = err instanceof Error ? err.message : 'Unknown error'
        console.warn(`  ⚠ Warning: Failed to apply ${yamlFile}: ${message}`)
      }
    }

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to apply YAML files from ${seedDir}: ${message}`)
  }
}

/**
 * Wait for pods to be ready in a namespace
 * Returns success even if some pods are in error state (for troubleshooting seeds)
 */
export const waitForPodsReady = (namespace?: string): Result<void, string> => {
  try {
    const nsFlag = namespace ? `-n ${namespace}` : '--all-namespaces'
    const timeout = '60s'

    // Wait for pods, but don't fail if some are in error state
    try {
      execSync(`kubectl wait --for=condition=Ready pod --all ${nsFlag} --timeout=${timeout}`, {
        stdio: 'pipe'
      })
    } catch {
      // Some pods might be in error state intentionally (troubleshooting seeds)
      // Check if at least some pods are ready
      const output = execSync(`kubectl get pods ${nsFlag} -o json`, { encoding: 'utf-8' })
      const pods = JSON.parse(output)
      const readyPods =
        pods.items?.filter((p: any) => p.status?.phase === 'Running' || p.status?.phase === 'Succeeded') || []

      if (readyPods.length === 0) {
        return error('No pods are ready')
      }

      console.log(`  ⚠ Some pods are not ready (expected for troubleshooting seeds)`)
    }

    return success(undefined)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return error(`Failed to wait for pods: ${message}`)
  }
}

/**
 * Get the path to a seed directory
 */
export const getSeedPath = (seedName: string): string => {
  const projectRoot = process.cwd()
  return join(projectRoot, 'src', 'core', 'cluster', 'seeds', seedName)
}
