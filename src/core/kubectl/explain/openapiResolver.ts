import type { JSONSchema, OpenAPISpec } from '../../openapi/loader'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { OpenAPIResourceTarget } from './openapiResourceMapper'

export interface OpenAPIExplainResolved {
  target: OpenAPIResourceTarget
  fieldName?: string
  schema: JSONSchema
  descriptions: string[]
}

const REF_PREFIX = '#/components/schemas/'

const unionRequired = (left: string[] = [], right: string[] = []): string[] => {
  return Array.from(new Set([...left, ...right]))
}

const uniqueDescriptions = (descriptions: string[]): string[] => {
  const deduped = descriptions
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  return Array.from(new Set(deduped))
}

const cloneSchema = (schema: JSONSchema): JSONSchema => {
  return { ...schema }
}

const mergeSchemas = (base: JSONSchema, extra: JSONSchema): JSONSchema => {
  const merged: JSONSchema = { ...base, ...extra }
  const baseProperties = base.properties || {}
  const extraProperties = extra.properties || {}
  merged.properties = { ...baseProperties, ...extraProperties }
  merged.required = unionRequired(base.required, extra.required)

  if (base.description && extra.description) {
    merged.description = `${base.description}\n${extra.description}`
  }

  if (base.items && extra.items) {
    merged.items = mergeSchemas(base.items, extra.items)
  } else if (extra.items) {
    merged.items = extra.items
  } else if (base.items) {
    merged.items = base.items
  }

  if (base.additionalProperties && extra.additionalProperties) {
    if (
      typeof base.additionalProperties !== 'boolean' &&
      typeof extra.additionalProperties !== 'boolean'
    ) {
      merged.additionalProperties = mergeSchemas(
        base.additionalProperties,
        extra.additionalProperties
      )
    } else {
      merged.additionalProperties = extra.additionalProperties
    }
  }

  return merged
}

const refNameFromRef = (refValue: string): Result<string> => {
  if (!refValue.startsWith(REF_PREFIX)) {
    return error(`unsupported ref format "${refValue}"`)
  }
  const schemaName = refValue.slice(REF_PREFIX.length)
  if (schemaName.length === 0) {
    return error(`invalid ref "${refValue}"`)
  }
  return success(schemaName)
}

const normalizeSchema = (
  spec: OpenAPISpec,
  schema: JSONSchema,
  seenRefs: Set<string> = new Set()
): Result<JSONSchema> => {
  let resolved = cloneSchema(schema)

  if (resolved.$ref) {
    const refNameResult = refNameFromRef(resolved.$ref)
    if (!refNameResult.ok) {
      return refNameResult
    }
    const refName = refNameResult.value
    if (seenRefs.has(refName)) {
      return success(resolved)
    }

    const refSchema = spec.components.schemas[refName]
    if (!refSchema) {
      return error(`OpenAPI schema reference "${refName}" not found`)
    }

    seenRefs.add(refName)
    const normalizedRef = normalizeSchema(spec, refSchema, seenRefs)
    seenRefs.delete(refName)
    if (!normalizedRef.ok) {
      return normalizedRef
    }

    const localWithoutRef = { ...resolved }
    delete localWithoutRef.$ref
    ;(localWithoutRef as Record<string, unknown>)['x-resolved-ref'] = refName
    resolved = mergeSchemas(normalizedRef.value, localWithoutRef)
  }

  if (resolved.allOf && resolved.allOf.length > 0) {
    let merged = cloneSchema(resolved)
    delete merged.allOf
    for (const child of resolved.allOf) {
      const normalizedChild = normalizeSchema(spec, child, seenRefs)
      if (!normalizedChild.ok) {
        return normalizedChild
      }
      merged = mergeSchemas(merged, normalizedChild.value)
    }
    resolved = merged
  }

  if (resolved.items) {
    const normalizedItems = normalizeSchema(spec, resolved.items, seenRefs)
    if (!normalizedItems.ok) {
      return normalizedItems
    }
    resolved.items = normalizedItems.value
  }

  if (resolved.properties) {
    const normalizedProperties: Record<string, JSONSchema> = {}
    for (const [key, value] of Object.entries(resolved.properties)) {
      const normalizedProperty = normalizeSchema(spec, value, seenRefs)
      if (!normalizedProperty.ok) {
        return normalizedProperty
      }
      normalizedProperties[key] = normalizedProperty.value
    }
    resolved.properties = normalizedProperties
  }

  if (
    resolved.additionalProperties &&
    typeof resolved.additionalProperties !== 'boolean'
  ) {
    const normalizedAdditional = normalizeSchema(
      spec,
      resolved.additionalProperties,
      seenRefs
    )
    if (!normalizedAdditional.ok) {
      return normalizedAdditional
    }
    resolved.additionalProperties = normalizedAdditional.value
  }

  return success(resolved)
}

const resolveChildSchema = (
  current: JSONSchema,
  segment: string
): JSONSchema | undefined => {
  if (current.properties && current.properties[segment]) {
    return current.properties[segment]
  }

  if (current.items && current.items.properties && current.items.properties[segment]) {
    return current.items.properties[segment]
  }

  if (
    current.additionalProperties &&
    typeof current.additionalProperties !== 'boolean' &&
    current.additionalProperties.properties &&
    current.additionalProperties.properties[segment]
  ) {
    return current.additionalProperties.properties[segment]
  }

  return undefined
}

export const resolveOpenAPIExplainTarget = (
  spec: OpenAPISpec,
  target: OpenAPIResourceTarget,
  fieldPath: string[]
): Result<OpenAPIExplainResolved> => {
  const rootSchema = spec.components.schemas[target.schemaName]
  if (!rootSchema) {
    return error(
      `couldn't find resource for "${target.group}/${target.version}, Resource=${target.kind.toLowerCase()}s"`
    )
  }

  let currentResult = normalizeSchema(spec, rootSchema)
  if (!currentResult.ok) {
    return currentResult
  }

  let fieldName: string | undefined
  const descriptions: string[] = []

  for (const segment of fieldPath) {
    const currentSchema = currentResult.value
    const childSchema = resolveChildSchema(currentSchema, segment)
    if (!childSchema) {
      return error(`field "${segment}" does not exist`)
    }

    fieldName = segment
    if (childSchema.description) {
      descriptions.push(childSchema.description)
    }
    if (childSchema.items?.description) {
      descriptions.push(childSchema.items.description)
    }

    currentResult = normalizeSchema(spec, childSchema)
    if (!currentResult.ok) {
      return currentResult
    }
  }

  return success({
    target,
    fieldName,
    schema: currentResult.value,
    descriptions: uniqueDescriptions(descriptions)
  })
}
