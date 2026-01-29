// ═══════════════════════════════════════════════════════════════════════════
// SCENARIO TYPES
// ═══════════════════════════════════════════════════════════════════════════

import type { FsConfig } from '~/core/filesystem/debianFileSystem'

// Re-export for convenience
export type { FsConfig }

/**
 * A scenario defines the cluster and filesystem state
 */
export interface Scenario {
    name: string
    description?: string
    k8s: string[]
    fs?: FsConfig
}

/**
 * Input for creating a scenario (supports inheritance)
 */
export interface ScenarioInput {
    name: string
    description: string
    extends?: Scenario
    k8s?: {
        add?: string[]
        remove?: string[]
    }
    fs?: FsConfig
}

const resolveK8s = (input: ScenarioInput): string[] => {
    const base = input.extends?.k8s ?? []
    const { add = [], remove = [] } = input.k8s ?? {}
    return [...base.filter(c => !remove.includes(c)), ...add]
}

const resolveFs = (input: ScenarioInput): FsConfig | undefined => {
    const base = input.extends?.fs
    const override = input.fs

    // If no fs config at all, return undefined
    if (!base && !override) {
        return undefined
    }

    // Merge base and override
    return {
        ...base,
        ...override,
        files: { ...base?.files, ...override?.files }
    }
}

/**
 * Create a scenario from input, resolving inheritance
 */
export const scenario = (input: ScenarioInput): Scenario => ({
    name: input.name,
    description: input.description,
    k8s: resolveK8s(input),
    fs: resolveFs(input)
})
