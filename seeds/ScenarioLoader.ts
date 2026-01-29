// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO LOADER
// ═══════════════════════════════════════════════════════════════════════════
// Load K8s components from YAML files based on TypeScript scenarios

import { readFile } from 'fs/promises'
import { join } from 'path'
import type { Result } from '../src/core/shared/result'
import { error, success } from '../src/core/shared/result'
import type { Scenario } from '@seeds/scenarios/types'

// Re-export Scenario type
export type { Scenario } from '@seeds/scenarios/types'

// ─── Path Helpers ──────────────────────────────────────────────────────────

const getSeedsRoot = (): string => {
    return join(process.cwd(), 'seeds')
}

/**
 * Map component name prefix to subdirectory
 */
const getComponentSubdirectory = (name: string): string => {
    // Parse component name: {type}-{name}
    // Examples: pod-web -> pod/, node-control-plane -> node/, deployment-nginx -> deployment/
    const parts = name.split('-')
    if (parts.length < 2) {
        // Fallback: try to find in root (shouldn't happen with new structure)
        return ''
    }
    
    const type = parts[0]
    const subdirs = ['node', 'pod', 'deployment', 'service', 'configmap', 'secret']
    
    if (subdirs.includes(type)) {
        return type
    }
    
    // Fallback to root if type not recognized
    return ''
}

/**
 * Get the filename from component name (remove prefix)
 */
const getComponentFilename = (name: string): string => {
    // Remove type prefix: pod-web -> web, node-control-plane -> control-plane
    const parts = name.split('-')
    if (parts.length < 2) {
        return name
    }
    
    const type = parts[0]
    const subdirs = ['node', 'pod', 'deployment', 'service', 'configmap', 'secret']
    
    if (subdirs.includes(type)) {
        // Remove type prefix and join remaining parts with dash
        return parts.slice(1).join('-')
    }
    
    // Fallback: return name as-is
    return name
}

const getK8sComponentPath = (name: string): string => {
    const subdir = getComponentSubdirectory(name)
    const filename = getComponentFilename(name)
    
    if (subdir) {
        return join(getSeedsRoot(), 'k8s', subdir, `${filename}.yaml`)
    }
    
    // Fallback to old structure (for backward compatibility)
    return join(getSeedsRoot(), 'k8s', `${name}.yaml`)
}

// ─── K8s Component Loading ─────────────────────────────────────────────────

/**
 * Load a single K8s component YAML file
 */
export const loadK8sComponent = async (name: string): Promise<Result<string>> => {
    const componentPath = getK8sComponentPath(name)
    try {
        const content = await readFile(componentPath, 'utf-8')
        return success(content)
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return error(`Failed to load K8s component '${name}': ${message}`)
    }
}

/**
 * Load all K8s components for a scenario and combine into multi-document YAML
 */
export const loadK8sComponentsForScenario = async (
    scenario: Scenario
): Promise<Result<string>> => {
    const documents: string[] = []

    for (const componentName of scenario.k8s) {
        const result = await loadK8sComponent(componentName)
        if (!result.ok) {
            return result
        }
        documents.push(result.value.trim())
    }

    // Combine with YAML document separators
    return success(documents.join('\n---\n'))
}

// ─── Public API ────────────────────────────────────────────────────────────

export { getSeedsRoot, getK8sComponentPath }
