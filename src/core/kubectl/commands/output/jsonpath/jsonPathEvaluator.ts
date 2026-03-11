import { JSONPath } from 'jsonpath-plus'
import type { Result } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'

type JsonPathInput = string | number | boolean | object | any[] | null

const stripOuterBraces = (expression: string): string => {
  const trimmed = expression.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const normalizeKubectlFirstIndexShortcut = (expression: string): string => {
  return expression.replace(/\[\s*\]/g, '[0]')
}

const normalizeRootPrefix = (expression: string): string => {
  if (expression.startsWith('$')) {
    return expression
  }
  if (expression.startsWith('@')) {
    return `$${expression.slice(1)}`
  }
  if (expression.startsWith('.')) {
    return `$${expression}`
  }
  if (expression.startsWith('[')) {
    return `$${expression}`
  }
  return `$.${expression}`
}

const normalizeEscapedDotPaths = (expression: string): string => {
  let output = ''
  let cursor = 0

  while (cursor < expression.length) {
    const char = expression[cursor]
    if (char !== '.') {
      output += char
      cursor += 1
      continue
    }

    let lookahead = cursor + 1
    let segment = ''
    let containsEscapedDot = false
    while (lookahead < expression.length) {
      const lookChar = expression[lookahead]
      if (lookChar === '\\' && expression[lookahead + 1] === '.') {
        containsEscapedDot = true
        segment += '.'
        lookahead += 2
        continue
      }
      if (lookChar === '.' || lookChar === '[' || lookChar === ']') {
        break
      }
      segment += lookChar
      lookahead += 1
    }

    if (segment.length === 0 || !containsEscapedDot) {
      output += '.'
      cursor += 1
      continue
    }

    const escapedSingleQuotes = segment.replace(/'/g, "\\'")
    output += `['${escapedSingleQuotes}']`
    cursor = lookahead
  }

  return output
}

const normalizeExpression = (rawExpression: string): Result<string> => {
  const stripped = stripOuterBraces(rawExpression)
  if (stripped.length === 0) {
    return error('error: invalid jsonpath expression')
  }
  if (stripped.includes('=~')) {
    return error('error: jsonpath regular expressions are not supported')
  }

  const withRoot = normalizeRootPrefix(stripped)
  const withFirstIndex = normalizeKubectlFirstIndexShortcut(withRoot)
  const withEscapedDotSupport = normalizeEscapedDotPaths(withFirstIndex)
  return success(withEscapedDotSupport)
}

const isJsonPathInput = (value: unknown): value is JsonPathInput => {
  if (value == null) {
    return true
  }
  const valueType = typeof value
  if (
    valueType === 'string' ||
    valueType === 'number' ||
    valueType === 'boolean'
  ) {
    return true
  }
  return valueType === 'object'
}

export const evaluateKubectlJsonPathValues = (
  payload: unknown,
  expression: string
): Result<unknown[]> => {
  const normalizedResult = normalizeExpression(expression)
  if (!normalizedResult.ok) {
    return normalizedResult
  }
  if (!isJsonPathInput(payload)) {
    return error('error: invalid jsonpath payload')
  }

  try {
    const rawValues = JSONPath({
      path: normalizedResult.value,
      json: payload,
      wrap: true
    }) as unknown
    if (!Array.isArray(rawValues)) {
      return error('error: invalid jsonpath expression')
    }
    const values = rawValues as unknown[]
    return success(values)
  } catch {
    return error('error: invalid jsonpath expression')
  }
}
