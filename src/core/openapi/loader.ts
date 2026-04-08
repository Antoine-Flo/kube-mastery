// ═══════════════════════════════════════════════════════════════════════════
// OPENAPI SPEC LOADER (SHARED)
// ═══════════════════════════════════════════════════════════════════════════
// Shared loader for Kubernetes OpenAPI v3 specs used by runtime and tests.
// Specs under ./specs/ are sourced from Kubernetes v1.35.3 (api/openapi-spec/v3).

import type { Result } from '../shared/result'
import { error, success } from '../shared/result'

import apiV1Spec from './specs/api__v1_openapi.json'
import appsV1Spec from './specs/apis__apps__v1_openapi.json'
import coordinationV1Spec from './specs/apis__coordination.k8s.io__v1_openapi.json'
import discoveryV1Spec from './specs/apis__discovery.k8s.io__v1_openapi.json'
import networkingV1Spec from './specs/apis__networking.k8s.io__v1_openapi.json'
import storageV1Spec from './specs/apis__storage.k8s.io__v1_openapi.json'

export interface OpenAPISpec {
  openapi?: string
  info?: {
    title?: string
    version?: string
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
  additionalProperties?: boolean | JSONSchema
  [key: string]: unknown
}

const RAW_SPECS: Record<string, unknown> = {
  'api__v1_openapi.json': apiV1Spec,
  'apis__apps__v1_openapi.json': appsV1Spec,
  'apis__coordination.k8s.io__v1_openapi.json': coordinationV1Spec,
  'apis__discovery.k8s.io__v1_openapi.json': discoveryV1Spec,
  'apis__networking.k8s.io__v1_openapi.json': networkingV1Spec,
  'apis__storage.k8s.io__v1_openapi.json': storageV1Spec
}

const cache = new Map<string, OpenAPISpec>()

const validateSpec = (filename: string, spec: unknown): Result<OpenAPISpec> => {
  if (!spec || typeof spec !== 'object') {
    return error(`Invalid spec file: ${filename} - not an object`)
  }

  const specObject = spec as Record<string, unknown>
  if (!specObject.components || typeof specObject.components !== 'object') {
    return error(`Invalid spec file: ${filename} - missing components`)
  }

  const components = specObject.components as Record<string, unknown>
  if (!components.schemas || typeof components.schemas !== 'object') {
    return error(`Invalid spec file: ${filename} - missing components.schemas`)
  }

  return success(spec as OpenAPISpec)
}

export const loadOpenAPISpec = async (
  filename: string
): Promise<Result<OpenAPISpec>> => {
  return loadOpenAPISpecSync(filename)
}

export const loadOpenAPISpecSync = (filename: string): Result<OpenAPISpec> => {
  const cached = cache.get(filename)
  if (cached) {
    return success(cached)
  }

  const spec = RAW_SPECS[filename]
  if (!spec) {
    return error(
      `Spec file not found: ${filename}. Available: ${Object.keys(RAW_SPECS).join(', ')}`
    )
  }

  const validation = validateSpec(filename, spec)
  if (!validation.ok) {
    return validation
  }

  cache.set(filename, validation.value)
  return success(validation.value)
}
