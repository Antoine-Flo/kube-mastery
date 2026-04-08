// ═══════════════════════════════════════════════════════════════════════════
// YAML PARSER & VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════
// Parse and validate YAML manifests for Kubernetes resources.
// Uses Zod schemas defined in resource models for validation.

import { parseAllDocuments } from 'yaml'
import type { Result } from '../shared/result'
import { error, success } from '../shared/result'
import {
  MANIFEST_PARSERS,
  type ParsedYamlResource,
  YAML_SUPPORTED_RESOURCE_KINDS,
  type YamlSupportedKind
} from './generated/yamlManifestParsers.generated'

// ─── YAML Parsing ────────────────────────────────────────────────────────

/**
 * Parse YAML string with error handling
 */
const parseYamlDocuments = (yamlContent: string): Result<unknown[]> => {
  try {
    const yamlDocuments = parseAllDocuments(yamlContent)
    const parseErrorDocument = yamlDocuments.find((document) => {
      return document.errors.length > 0
    })
    if (parseErrorDocument != null) {
      const parseError = parseErrorDocument.errors[0]
      return error(`YAML parse error: ${parseError.message}`)
    }

    const parsedDocuments = yamlDocuments
      .map((document) => document.toJSON())
      .filter((document) => {
        return document != null
      })

    if (parsedDocuments.length === 0) {
      return error('YAML content is empty or invalid')
    }
    return success(parsedDocuments)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown YAML parse error'
    return error(`YAML parse error: ${message}`)
  }
}

/**
 * Check if kind is supported
 */
const isSupportedKind = (kind: string): kind is YamlSupportedKind => {
  return YAML_SUPPORTED_RESOURCE_KINDS.includes(kind as YamlSupportedKind)
}

/**
 * Route validation to resource-specific parser
 */
const validateResource = (obj: any): Result<ParsedYamlResource> => {
  // Basic structure validation
  if (!obj.kind || typeof obj.kind !== 'string') {
    return error('Missing or invalid kind')
  }

  if (!isSupportedKind(obj.kind)) {
    const supportedKinds = YAML_SUPPORTED_RESOURCE_KINDS.join(', ')
    return error(
      `Unsupported resource kind: ${obj.kind} (supported: ${supportedKinds})`
    )
  }

  const parser = MANIFEST_PARSERS[obj.kind as YamlSupportedKind]
  return parser(obj)
}

// ─── Public API ──────────────────────────────────────────────────────────

/**
 * Parse and validate YAML manifest
 *
 * @param yamlContent - YAML string to parse
 * @returns Result with validated resource or error message
 */
export const parseKubernetesYaml = (
  yamlContent: string
): Result<ParsedYamlResource> => {
  const parseResult = parseYamlDocuments(yamlContent)
  if (!parseResult.ok) {
    return parseResult
  }

  if (parseResult.value.length !== 1) {
    return error(
      'YAML content contains multiple documents; expected a single resource'
    )
  }

  return validateResource(parseResult.value[0])
}

/**
 * Parse and validate one or many YAML manifests from a single file.
 *
 * @param yamlContent - YAML string to parse
 * @returns Result with validated resources or error message
 */
export const parseKubernetesYamlDocuments = (
  yamlContent: string
): Result<ParsedYamlResource[]> => {
  const parseResult = parseYamlDocuments(yamlContent)
  if (!parseResult.ok) {
    return parseResult
  }

  const resources: ParsedYamlResource[] = []
  for (let index = 0; index < parseResult.value.length; index++) {
    const validationResult = validateResource(parseResult.value[index])
    if (!validationResult.ok) {
      return error(validationResult.error)
    }
    resources.push(validationResult.value)
  }

  return success(resources)
}
