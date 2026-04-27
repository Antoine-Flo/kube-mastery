import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { renderKubectlJsonPath } from './jsonpath/renderer'
import { formatKubectlTable } from './outputHelpers'

const KUBECTL_TABLE_SPACING = 3

const JSON_PATH_RELAXED = /^\{\.?([^{}]*)\}$|^\.?([^{}]*)$/

/**
 * Converts a relaxed kubectl-style path (e.g. metadata.name, .metadata.name, {.metadata.name})
 * into a template expression {.fieldSpec} accepted by renderKubectlJsonPath.
 */
export const relaxedJsonPathToKubectlTemplate = (
  pathExpression: string
): Result<string> => {
  const trimmed = pathExpression.trim()
  if (trimmed.length === 0) {
    return success('')
  }
  const match = trimmed.match(JSON_PATH_RELAXED)
  if (match == null) {
    return error(
      "error: unexpected path string, expected a 'name1.name2' or '.name1.name2' or '{name1.name2}' or '{.name1.name2}'"
    )
  }
  const fieldSpec = (match[1] ?? '').length > 0 ? match[1] : (match[2] ?? '')
  return success(`{.${fieldSpec}}`)
}

export interface CustomColumnSpec {
  header: string
  pathExpr: string
}

/**
 * Parses custom-columns spec string into header/path pairs.
 * Caller must have validated that spec is non-empty and each segment has header:path.
 */
export const parseCustomColumnsSpec = (
  spec: string
): Result<CustomColumnSpec[]> => {
  const trimmed = spec.trim()
  if (trimmed.length === 0) {
    return success([])
  }
  const parts = trimmed.split(',')
  const columns: CustomColumnSpec[] = []
  for (const part of parts) {
    const trimmedPart = part.trim()
    const colonIndex = trimmedPart.indexOf(':')
    if (colonIndex === -1) {
      return error(
        `error: unexpected custom-columns spec: ${trimmedPart}, expected <header>:<json-path-expr>`
      )
    }
    const header = trimmedPart.slice(0, colonIndex).trim()
    const pathExpr = trimmedPart.slice(colonIndex + 1).trim()
    if (pathExpr.length === 0) {
      return error(
        `error: unexpected custom-columns spec: ${trimmedPart}, expected <header>:<json-path-expr>`
      )
    }
    columns.push({ header, pathExpr })
  }
  return success(columns)
}

/**
 * Renders a table from custom-columns spec and list of items.
 * Each row is one item; each cell is the result of the column's jsonpath on that item.
 */
export const renderCustomColumnsTable = (
  spec: string,
  items: unknown[],
  options: {
    noHeaders?: boolean
  } = {}
): Result<string> => {
  const columnsResult = parseCustomColumnsSpec(spec)
  if (!columnsResult.ok) {
    return columnsResult
  }
  const columns = columnsResult.value
  if (columns.length === 0 || items.length === 0) {
    return success('')
  }

  const headers = columns.map((col) => col.header)
  const templates: Result<string>[] = columns.map((col) =>
    relaxedJsonPathToKubectlTemplate(col.pathExpr)
  )
  const firstError = templates.find((t) => !t.ok)
  if (firstError != null && !firstError.ok) {
    return firstError
  }
  const templateStrings = (templates as { ok: true; value: string }[]).map(
    (t) => t.value
  )

  const rows: string[][] = []
  for (const item of items) {
    const row: string[] = []
    for (const template of templateStrings) {
      const cellResult = renderKubectlJsonPath(item, template)
      if (!cellResult.ok) {
        return cellResult
      }
      row.push(cellResult.value)
    }
    rows.push(row)
  }

  const tableOutput = formatKubectlTable(headers, rows, {
    spacing: KUBECTL_TABLE_SPACING,
    align: headers.map(() => 'left' as const),
    noHeaders: options.noHeaders === true
  })
  return success(tableOutput)
}
