// ═══════════════════════════════════════════════════════════════════════════
// SEED LOADER
// ═══════════════════════════════════════════════════════════════════════════
// Load K8s resources from YAML (directory or content) and create ApiServerFacade.
// Single source of truth: seeds in src/courses/seeds/<seedName>/*.yaml

import type { EventBus } from '../events/EventBus'
import {
  createApiServerFacade,
  type ApiServerFacade
} from '../../api/ApiServerFacade'
import type { ConfigMap } from '../ressources/ConfigMap'
import type { DaemonSet } from '../ressources/DaemonSet'
import type { Deployment } from '../ressources/Deployment'
import type { Ingress } from '../ressources/Ingress'
import type { NetworkPolicy } from '../ressources/NetworkPolicy'
import type { Node } from '../ressources/Node'
import type { PersistentVolume } from '../ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../ressources/PersistentVolumeClaim'
import type { Pod } from '../ressources/Pod'
import type { ReplicaSet } from '../ressources/ReplicaSet'
import type { Secret } from '../ressources/Secret'
import type { Service } from '../ressources/Service'
import { applyResourceWithEvents } from '../../kubectl/commands/resourceHelpers'
import { parseKubernetesYaml } from '../../kubectl/yamlParser'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { createSimulatorBootstrapConfig } from '../systemBootstrap'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

// ─── Multi-Document YAML Parsing ──────────────────────────────────────────

/**
 * Split multi-document YAML by `---` separator
 */
const splitYamlDocuments = (yamlContent: string): string[] => {
  const documents = yamlContent.split(/^---\s*$/m)
  return documents.filter((doc) => doc.trim().length > 0)
}

/**
 * Parse a single YAML document (supported kinds only)
 */
type ParsedResource =
  | Pod
  | ConfigMap
  | Secret
  | Node
  | PersistentVolume
  | PersistentVolumeClaim
  | ReplicaSet
  | Deployment
  | DaemonSet
  | Service
  | Ingress
  | NetworkPolicy

/**
 * Parse multi-document YAML, skipping unsupported kinds (e.g. Namespace).
 * Real cluster applies all YAML; simulator only applies supported resources.
 */
const parseMultiDocumentYamlSkipUnsupported = (
  yamlContent: string
): ParsedResource[] => {
  const documents = splitYamlDocuments(yamlContent)
  const resources: ParsedResource[] = []

  for (const doc of documents) {
    const result = parseKubernetesYaml(doc.trim())
    if (result.ok) {
      resources.push(result.value as ParsedResource)
    }
    // Skip unsupported kinds (e.g. Namespace) without failing
  }

  return resources
}

// ─── Load from YAML content ──────────────────────────────────────────────

/**
 * Create ApiServerFacade from concatenated YAML content.
 * Skips unsupported resource kinds.
 */
const loadApiServerFromYamlContent = (
  yamlContent: string,
  eventBus?: EventBus
): Result<ApiServerFacade, string> => {
  const apiServer = createApiServerFacade({
    eventBus,
    bootstrap: createSimulatorBootstrapConfig()
  })
  const resources = parseMultiDocumentYamlSkipUnsupported(yamlContent)

  for (const resource of resources) {
    const applyResult = applyResourceWithEvents(resource, apiServer)
    if (!applyResult.ok) {
      return error(`Failed to apply resource: ${applyResult.error}`)
    }
  }

  return success(apiServer)
}

/**
 * Read all YAML files from a seed directory (flat, no recursion).
 * Files are sorted by name for deterministic order. Documents are
 * concatenated with "---" separator.
 *
 * @param absolutePath - Absolute path to the seed directory
 * @returns Concatenated YAML string
 */
const loadSeedYamlFromPath = (absolutePath: string): string => {
  const entries = readdirSync(absolutePath, { withFileTypes: true })
  const yamlFiles = entries
    .filter(
      (e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml'))
    )
    .map((e) => join(absolutePath, e.name))
    .sort()

  const parts: string[] = []
  for (const filePath of yamlFiles) {
    const content = readFileSync(filePath, 'utf-8').trim()
    if (content.length > 0) {
      parts.push(content)
    }
  }
  return parts.join('\n---\n')
}

/**
 * Create ApiServerFacade from a seed directory path (absolute).
 * Reads all .yaml/.yml files from the directory, then loads as YAML content.
 */
export const loadApiServerFromSeedPath = (
  seedPath: string,
  eventBus?: EventBus
): Result<ApiServerFacade, string> => {
  try {
    const yamlContent = loadSeedYamlFromPath(seedPath)
    return loadApiServerFromYamlContent(yamlContent, eventBus)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return error(`Failed to load seed from ${seedPath}: ${message}`)
  }
}
