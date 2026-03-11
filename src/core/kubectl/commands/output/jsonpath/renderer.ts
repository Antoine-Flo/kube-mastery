import type { Result } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import { evaluateKubectlJsonPathValues } from './jsonPathEvaluator'
import { parseKubectlJsonPathTemplate } from './templateParser'
import type { TemplateNode } from './types'

const stringifyNodeValue = (value: unknown): string => {
  if (value == null) {
    return ''
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value)
  }
  return JSON.stringify(value)
}

const evaluateExpression = (
  contextValue: unknown,
  expression: string
): Result<string> => {
  const trimmedExpression = expression.trim()
  if (trimmedExpression === '@') {
    return success(stringifyNodeValue(contextValue))
  }
  const valuesResult = evaluateKubectlJsonPathValues(contextValue, trimmedExpression)
  if (!valuesResult.ok) {
    return valuesResult
  }
  if (valuesResult.value.length === 0) {
    return success('')
  }
  if (valuesResult.value.length === 1) {
    return success(stringifyNodeValue(valuesResult.value[0]))
  }
  return success(valuesResult.value.map((value) => stringifyNodeValue(value)).join(' '))
}

const renderNodes = (
  nodes: TemplateNode[],
  contextValue: unknown
): Result<string> => {
  let output = ''

  for (const node of nodes) {
    if (node.type === 'text' || node.type === 'literal') {
      output += node.value
      continue
    }
    if (node.type === 'expression') {
      const expressionResult = evaluateExpression(contextValue, node.value)
      if (!expressionResult.ok) {
        return expressionResult
      }
      output += expressionResult.value
      continue
    }

    const rangeValuesResult = evaluateKubectlJsonPathValues(
      contextValue,
      node.expression
    )
    if (!rangeValuesResult.ok) {
      return rangeValuesResult
    }
    for (const item of rangeValuesResult.value) {
      const childResult = renderNodes(node.children, item)
      if (!childResult.ok) {
        return childResult
      }
      output += childResult.value
    }
  }

  return success(output)
}

export const renderKubectlJsonPath = (
  payload: unknown,
  expression: string
): Result<string> => {
  const parsedTemplateResult = parseKubectlJsonPathTemplate(expression)
  if (!parsedTemplateResult.ok) {
    return parsedTemplateResult
  }
  return renderNodes(parsedTemplateResult.value, payload)
}
