import type { JSONSchema } from '../../openapi/loader'
import type { OpenAPIExplainResolved } from './openapiResolver'

const appendWrapped = (
  lines: string[],
  text: string,
  width: number,
  indent: string
): void => {
  const words = text.trim().split(/\s+/)
  if (words.length === 0 || (words.length === 1 && words[0] === '')) {
    return
  }

  let current = indent
  for (const word of words) {
    const nextLength =
      current.length + (current === indent ? 0 : 1) + word.length
    if (nextLength > width && current !== indent) {
      lines.push(current)
      current = `${indent}${word}`
      continue
    }
    if (current === indent) {
      current = `${indent}${word}`
      continue
    }
    current = `${current} ${word}`
  }
  lines.push(current)
}

const schemaNameFromRef = (refValue: string): string => {
  const chunks = refValue.split('/')
  return chunks[chunks.length - 1]
}

const prettyTypeFromSchemaName = (schemaName: string): string => {
  const tokens = schemaName.split('.')
  return tokens[tokens.length - 1] || 'Object'
}

const guessType = (schema: JSONSchema): string => {
  const resolvedRef = schema['x-resolved-ref']
  if (typeof resolvedRef === 'string' && resolvedRef.length > 0) {
    return prettyTypeFromSchemaName(resolvedRef)
  }

  if (schema.items) {
    return `[]${guessType(schema.items)}`
  }

  if (schema.additionalProperties) {
    if (typeof schema.additionalProperties === 'boolean') {
      return 'map[string]Object'
    }
    return `map[string]${guessType(schema.additionalProperties)}`
  }

  if (schema.$ref) {
    return prettyTypeFromSchemaName(schemaNameFromRef(schema.$ref))
  }

  if (typeof schema.type === 'string') {
    if (schema.type === 'object') {
      return 'Object'
    }
    return schema.type
  }

  if (schema.properties) {
    return 'Object'
  }

  return 'Object'
}

const resolveFieldContainer = (
  schema: JSONSchema
): Record<string, JSONSchema> => {
  if (schema.properties) {
    return schema.properties
  }
  if (schema.items?.properties) {
    return schema.items.properties
  }
  if (
    schema.additionalProperties &&
    typeof schema.additionalProperties !== 'boolean' &&
    schema.additionalProperties.properties
  ) {
    return schema.additionalProperties.properties
  }
  return {}
}

const resolveRequiredSet = (schema: JSONSchema): Set<string> => {
  if (schema.required) {
    return new Set(schema.required)
  }
  if (schema.items?.required) {
    return new Set(schema.items.required)
  }
  return new Set<string>()
}

const pushEnumBlock = (
  lines: string[],
  schema: JSONSchema,
  indentPrefix: string
): void => {
  if (!schema.enum || schema.enum.length === 0) {
    return
  }

  const enumValues = schema.enum.map((item) => String(item))
  lines.push(`${indentPrefix}enum: ${enumValues.join(', ')}`)
}

const pushFieldSummary = (
  lines: string[],
  fieldName: string,
  fieldSchema: JSONSchema,
  required: boolean,
  recursive: boolean,
  level = 1
): void => {
  const indentPrefix = '  '.repeat(level)
  const requiredSuffix = required ? ' -required-' : ''
  lines.push(
    `${indentPrefix}${fieldName}\t<${guessType(fieldSchema)}>${requiredSuffix}`
  )
  pushEnumBlock(lines, fieldSchema, indentPrefix)

  if (fieldSchema.description) {
    appendWrapped(lines, fieldSchema.description, 80, `${indentPrefix}  `)
  }
  lines.push('')

  if (!recursive) {
    return
  }

  const nestedFields = resolveFieldContainer(fieldSchema)
  const nestedRequired = resolveRequiredSet(fieldSchema)
  const nestedEntries = Object.entries(nestedFields).sort(([left], [right]) =>
    left.localeCompare(right)
  )
  for (const [nestedName, nestedSchema] of nestedEntries) {
    pushFieldSummary(
      lines,
      nestedName,
      nestedSchema,
      nestedRequired.has(nestedName),
      recursive,
      level + 1
    )
  }
}

export const renderExplainOutput = (
  resolved: OpenAPIExplainResolved,
  recursive: boolean
): string => {
  const lines: string[] = []

  if (resolved.target.group.length > 0) {
    lines.push(`GROUP:      ${resolved.target.group}`)
  }
  lines.push(`KIND:       ${resolved.target.kind}`)
  lines.push(`VERSION:    ${resolved.target.version}`)
  lines.push('')

  if (resolved.fieldName) {
    lines.push(
      `FIELD:    ${resolved.fieldName} <${guessType(resolved.schema)}>`
    )
    lines.push('')
  }

  lines.push('DESCRIPTION:')
  if (resolved.descriptions.length > 0) {
    for (const description of resolved.descriptions) {
      appendWrapped(lines, description, 80, '    ')
    }
  } else if (resolved.schema.description) {
    appendWrapped(lines, resolved.schema.description, 80, '    ')
  } else {
    lines.push('    <empty>')
  }

  const fields = resolveFieldContainer(resolved.schema)
  const fieldEntries = Object.entries(fields).sort(([left], [right]) =>
    left.localeCompare(right)
  )
  if (fieldEntries.length > 0) {
    lines.push('')
    lines.push('FIELDS:')
    const required = resolveRequiredSet(resolved.schema)
    for (const [fieldName, fieldSchema] of fieldEntries) {
      pushFieldSummary(
        lines,
        fieldName,
        fieldSchema,
        required.has(fieldName),
        recursive
      )
    }
  }

  return `${lines.join('\n')}\n`
}
