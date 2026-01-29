// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL APPLY & CREATE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
// Unified handlers for apply and create commands using event-driven architecture

import type { ClusterState } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error } from '../../../shared/result'
import { parseKubernetesYaml } from '../../yamlParser'
import type { ParsedCommand } from '../types'
import { applyResourceWithEvents, createResourceWithEvents } from './resourceHelpers'

/**
 * Shared helper to load and parse YAML from filesystem
 */
const loadAndParseYaml = (
    fileSystem: FileSystem,
    parsed: ParsedCommand
): ExecutionResult & { resource?: any } => {
    // Extract filename from flags
    const filename = parsed.flags.f || parsed.flags.filename

    if (!filename) {
        return error('error: must specify one of -f or --filename')
    }

    // Read file from filesystem
    const fileResult = fileSystem.readFile(filename as string)
    if (!fileResult.ok) {
        return error(`error: ${fileResult.error}`)
    }

    // Parse and validate YAML
    const parseResult = parseKubernetesYaml(fileResult.value)
    if (!parseResult.ok) {
        return error(`error: ${parseResult.error}`)
    }

    return { ok: true, value: '', resource: parseResult.value }
}

/**
 * Handle kubectl apply command
 * Creates or updates resources from YAML files
 */
export const handleApply = (
    fileSystem: FileSystem,
    clusterState: ClusterState,
    parsed: ParsedCommand,
    eventBus: EventBus
): ExecutionResult => {
    const loadResult = loadAndParseYaml(fileSystem, parsed)
    if (!loadResult.ok) {
        return loadResult
    }

    return applyResourceWithEvents(loadResult.resource, clusterState, eventBus)
}

/**
 * Handle kubectl create command
 * Creates resources from YAML files (fails if resource already exists)
 */
export const handleCreate = (
    fileSystem: FileSystem,
    clusterState: ClusterState,
    parsed: ParsedCommand,
    eventBus: EventBus
): ExecutionResult => {
    const loadResult = loadAndParseYaml(fileSystem, parsed)
    if (!loadResult.ok) {
        return loadResult
    }

    return createResourceWithEvents(loadResult.resource, clusterState, eventBus)
}

