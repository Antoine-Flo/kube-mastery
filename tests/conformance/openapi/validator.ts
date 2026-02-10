// ═══════════════════════════════════════════════════════════════════════════
// OPENAPI VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════
// Validates Kubernetes resources against OpenAPI schemas with $ref resolution

import Ajv, { type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'
import type { Result } from '../../../src/core/shared/result'
import { error, success } from '../../../src/core/shared/result'
import type { OpenAPISpec, JSONSchema } from './loader'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
}

export interface ValidationError {
  path: string
  message: string
  expected?: string
  received?: string
}

export interface OpenAPIValidator {
  validateResource(resource: unknown, apiVersion: string, kind: string): Result<ValidationResult>
  getSchema(apiVersion: string, kind: string): Result<JSONSchema>
}

// ─── Schema Name Mapping ────────────────────────────────────────────────────

/**
 * Map Kubernetes resource (apiVersion, kind) to OpenAPI schema name
 */
const getSchemaName = (apiVersion: string, kind: string): string => {
  if (apiVersion === 'v1') {
    return `io.k8s.api.core.v1.${kind}`
  }
  if (apiVersion.startsWith('apps/v1')) {
    return `io.k8s.api.apps.v1.${kind}`
  }
  return `io.k8s.api.${apiVersion.replace('/', '.')}.${kind}`
}

// ─── Schema Extraction ──────────────────────────────────────────────────────

/**
 * Get schema for a Kubernetes resource
 * Note: $ref resolution is handled by Ajv automatically
 */
const getSchemaForResource = (spec: OpenAPISpec, apiVersion: string, kind: string): Result<JSONSchema> => {
  const schemaName = getSchemaName(apiVersion, kind)
  const schema = spec.components.schemas[schemaName]

  if (!schema) {
    return error(`Schema not found: ${schemaName} (apiVersion: ${apiVersion}, kind: ${kind})`)
  }

  return success(schema)
}

// ─── Simulator Fields Removal ────────────────────────────────────────────────

/**
 * Remove _simulator field from resource before validation
 * This allows strict OpenAPI validation while keeping simulator-specific fields
 */
export const removeSimulatorFields = (resource: unknown): unknown => {
  if (typeof resource !== 'object' || resource === null) {
    return resource
  }
  const { _simulator, ...cleaned } = resource as { _simulator?: unknown; [key: string]: unknown }
  return cleaned
}

// ─── Error Formatting ───────────────────────────────────────────────────────

/**
 * Format Ajv validation errors into readable format
 */
const formatValidationErrors = (ajvErrors: ErrorObject[]): ValidationError[] => {
  return ajvErrors.map((err) => {
    const path = err.instancePath || err.schemaPath || 'root'
    let message = err.message || 'Validation failed'

    // Enhance message with context
    if (err.keyword === 'required') {
      const missing = err.params.missingProperty as string
      message = `Missing required property: ${missing}`
    } else if (err.keyword === 'type') {
      message = `Expected type ${err.params.type}, got ${typeof err.data}`
    }

    return {
      path,
      message,
      expected: err.params?.type as string | undefined,
      received: typeof err.data
    }
  })
}

// ─── Validator Factory ──────────────────────────────────────────────────────

/**
 * Create OpenAPI validator from spec
 * Uses Ajv's native $ref resolution instead of manual resolution
 */
export const createOpenAPIValidator = (spec: OpenAPISpec): OpenAPIValidator => {
  // Initialize Ajv with formats support
  const ajv = new Ajv({
    allErrors: true,
    strict: false, // Kubernetes schemas may have non-standard properties
    validateFormats: true
  })
  addFormats(ajv)

  // Add Kubernetes-specific format: int-or-string
  // Used for resources like CPU/memory that accept both "100m" (string) or 100 (number)
  ajv.addFormat('int-or-string', (data: unknown) => {
    return typeof data === 'number' || typeof data === 'string'
  })

  // Add all schemas to Ajv's schema registry for $ref resolution
  for (const [schemaName, schema] of Object.entries(spec.components.schemas)) {
    const schemaId = `#/components/schemas/${schemaName}`
    ajv.addSchema(schema, schemaId)
  }

  return {
    getSchema: (apiVersion: string, kind: string) => {
      return getSchemaForResource(spec, apiVersion, kind)
    },

    validateResource: (resource: unknown, apiVersion: string, kind: string) => {
      // Get schema name
      const schemaName = getSchemaName(apiVersion, kind)
      const schema = spec.components.schemas[schemaName]

      if (!schema) {
        return error(`Schema not found: ${schemaName} (apiVersion: ${apiVersion}, kind: ${kind})`)
      }

      // Use schema ID for Ajv
      const schemaId = `#/components/schemas/${schemaName}`

      // Compile and validate (Ajv handles $ref resolution automatically)
      try {
        let validate = ajv.getSchema(schemaId)
        if (!validate) {
          // Compile if not already compiled
          validate = ajv.compile(schema)
          // Register with schemaId for future lookups
          ajv.addSchema(schema, schemaId)
        }

        const valid = validate(resource)
        if (valid) {
          return success({ valid: true })
        }

        const errors = formatValidationErrors(validate.errors || [])
        return success({
          valid: false,
          errors
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return error(`Validation error: ${message}`)
      }
    }
  }
}
