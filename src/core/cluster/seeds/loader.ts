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
import { applyResourceWithEvents } from '../../kubectl/commands/resourceCatalog'
import {
  MANIFEST_PARSERS,
  type ParsedYamlResource,
  YAML_SUPPORTED_RESOURCE_KINDS,
  type YamlSupportedKind
} from '../../kubectl/generated/yamlManifestParsers.generated'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { createSimulatorBootstrapConfig } from '../systemBootstrap'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseAllDocuments } from 'yaml'

/**
 * Parse a single YAML document (supported kinds only)
 */
type ParsedResource =
  ParsedYamlResource

/**
 * Parse multi-document YAML, skipping unsupported kinds (e.g. Namespace).
 * Real cluster applies all YAML; simulator only applies supported resources.
 */
const parseMultiDocumentYamlSkipUnsupported = (
  yamlContent: string
): Result<ParsedResource[], string> => {
  const yamlDocuments = parseAllDocuments(yamlContent)
  const parseErrorDocument = yamlDocuments.find((document) => {
    return document.errors.length > 0
  })
  if (parseErrorDocument != null) {
    const parseError = parseErrorDocument.errors[0]
    return error(`YAML parse error: ${parseError.message}`)
  }

  const documents = yamlDocuments
    .map((document) => {
      return document.toJSON()
    })
    .filter((document) => {
      return document != null
    })
  const resources: ParsedResource[] = []

  for (const document of documents) {
    const doc = document as { kind?: unknown }
    if (typeof doc.kind !== 'string') {
      return error('Missing or invalid kind')
    }
    if (!YAML_SUPPORTED_RESOURCE_KINDS.includes(doc.kind as YamlSupportedKind)) {
      continue
    }
    const parser = MANIFEST_PARSERS[doc.kind as YamlSupportedKind]
    const result = parser(document)
    if (result.ok) {
      resources.push(result.value)
      continue
    }
    return error(result.error)
  }

  return success(resources)
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
  const resourcesResult = parseMultiDocumentYamlSkipUnsupported(yamlContent)
  if (!resourcesResult.ok) {
    return error(resourcesResult.error)
  }

  for (const resource of resourcesResult.value) {
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
