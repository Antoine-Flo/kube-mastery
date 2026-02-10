// ═══════════════════════════════════════════════════════════════════════════
// OPENAPI SPEC LOADER
// ═══════════════════════════════════════════════════════════════════════════
// Loads and parses OpenAPI specification files for Kubernetes conformance testing

import type { Result } from '../../../src/core/shared/result'
import { error, success } from '../../../src/core/shared/result'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OpenAPISpec {
  openapi: string
  info: {
    title: string
    version: string
  }
  components: {
    schemas: Record<string, JSONSchema>
  }
}

export type JSONSchema = {
  type?: string | string[]
  properties?: Record<string, JSONSchema>
  required?: string[]
  allOf?: JSONSchema[]
  anyOf?: JSONSchema[]
  oneOf?: JSONSchema[]
  items?: JSONSchema
  enum?: unknown[]
  $ref?: string
  description?: string
  default?: unknown
  format?: string
  [key: string]: unknown
}

// ─── Loader Functions ──────────────────────────────────────────────────────

// Static imports for specs (Vite requires static imports)
import apiV1Spec from './specs/api__v1_openapi.json'
import appsV1Spec from './specs/apis__apps__v1_openapi.json'

const SPECS: Record<string, unknown> = {
  'api__v1_openapi.json': apiV1Spec,
  'apis__apps__v1_openapi.json': appsV1Spec
}

/**
 * Load OpenAPI spec from JSON file
 * Uses static imports for Vite compatibility
 */
export const loadOpenAPISpec = async (filename: string): Promise<Result<OpenAPISpec>> => {
  const spec = SPECS[filename]

  if (!spec) {
    return error(`Spec file not found: ${filename}. Available: ${Object.keys(SPECS).join(', ')}`)
  }

  // Validate basic structure
  if (!spec || typeof spec !== 'object') {
    return error(`Invalid spec file: ${filename} - not an object`)
  }

  const specObj = spec as Record<string, unknown>
  if (!specObj.components || typeof specObj.components !== 'object') {
    return error(`Invalid spec file: ${filename} - missing components`)
  }

  const components = specObj.components as Record<string, unknown>
  if (!components.schemas || typeof components.schemas !== 'object') {
    return error(`Invalid spec file: ${filename} - missing components.schemas`)
  }

  return success(spec as OpenAPISpec)
}
