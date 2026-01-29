// ═══════════════════════════════════════════════════════════════════════════
// SEED LOADER
// ═══════════════════════════════════════════════════════════════════════════
// Load K8s resources from scenarios and create ClusterState
// This file is only used server-side (in API routes)

import type { ClusterState, ClusterStateData } from '../ClusterState'
import { createClusterState } from '../ClusterState'
import type { EventBus } from '../events/EventBus'
import { createEventBus } from '../events/EventBus'
import type { ConfigMap } from '../ressources/ConfigMap'
import type { Deployment } from '../ressources/Deployment'
import type { Node } from '../ressources/Node'
import type { Pod } from '../ressources/Pod'
import type { ReplicaSet } from '../ressources/ReplicaSet'
import type { Secret } from '../ressources/Secret'
import type { Service } from '../ressources/Service'
import { applyResourceWithEvents } from '../../kubectl/commands/handlers/resourceHelpers'
import { parseKubernetesYaml } from '../../kubectl/yamlParser'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { loadK8sComponentsForScenario, type Scenario } from '../../../../seeds/ScenarioLoader'

// ─── Multi-Document YAML Parsing ──────────────────────────────────────────

/**
 * Split multi-document YAML by `---` separator
 */
const splitYamlDocuments = (yamlContent: string): string[] => {
    const documents = yamlContent.split(/^---\s*$/m)
    return documents.filter(doc => doc.trim().length > 0)
}

/**
 * Parse a single YAML document
 */
type ParsedResource = Pod | ConfigMap | Secret | Node | ReplicaSet | Deployment | Service

const parseYamlDocument = (yamlContent: string): Result<ParsedResource> => {
    const result = parseKubernetesYaml(yamlContent)
    if (!result.ok) {
        return error(result.error)
    }
    return success(result.value)
}

/**
 * Parse multi-document YAML
 */
const parseMultiDocumentYaml = (yamlContent: string): Result<Array<ParsedResource>> => {
    const documents = splitYamlDocuments(yamlContent)
    const resources: Array<ParsedResource> = []

    for (const doc of documents) {
        const result = parseYamlDocument(doc.trim())
        if (!result.ok) {
            return error(`Failed to parse YAML document: ${result.error}`)
        }
        resources.push(result.value)
    }

    return success(resources)
}

// ─── Scenario Loading ──────────────────────────────────────────────────────

/**
 * Load a scenario and create ClusterState
 */
const loadScenario = async (
    scenario: Scenario,
    eventBus?: EventBus
): Promise<Result<ClusterState>> => {
    const bus = eventBus || createEventBus()
    const clusterState = createClusterState(bus)

    // Load all K8s components
    const yamlResult = await loadK8sComponentsForScenario(scenario)
    if (!yamlResult.ok) {
        return error(yamlResult.error)
    }

    // Parse the combined YAML
    const parseResult = parseMultiDocumentYaml(yamlResult.value)
    if (!parseResult.ok) {
        return error(parseResult.error)
    }

    // Apply each resource to the cluster state
    for (const resource of parseResult.value) {
        const applyResult = applyResourceWithEvents(resource, clusterState, bus)
        if (!applyResult.ok) {
            return error(`Failed to apply resource: ${applyResult.error}`)
        }
    }

    return success(clusterState)
}

/**
 * Load a scenario and return ClusterStateData
 */
export const loadScenarioData = async (scenario: Scenario): Promise<ClusterStateData> => {
    const result = await loadScenario(scenario)
    if (!result.ok) {
        throw new Error(result.error)
    }
    return result.value.toJSON()
}
