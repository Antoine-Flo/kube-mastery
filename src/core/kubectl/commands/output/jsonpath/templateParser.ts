import type { Result } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { TemplateNode } from './types'

const decodeSingleQuotedLiteral = (raw: string): string => {
  let output = ''
  let escaping = false
  for (let index = 0; index < raw.length; index++) {
    const char = raw[index]
    if (!escaping && char === '\\') {
      escaping = true
      continue
    }
    if (escaping) {
      if (char === 'n') {
        output += '\n'
      } else if (char === 't') {
        output += '\t'
      } else if (char === 'r') {
        output += '\r'
      } else {
        output += char
      }
      escaping = false
      continue
    }
    output += char
  }
  if (escaping) {
    output += '\\'
  }
  return output
}

const decodeQuotedLiteral = (content: string): Result<string> => {
  const trimmed = content.trim()
  if (trimmed.length < 2) {
    return error('error: invalid quoted literal in jsonpath template')
  }

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return success(JSON.parse(trimmed) as string)
    } catch {
      return error('error: invalid quoted literal in jsonpath template')
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const body = trimmed.slice(1, -1)
    return success(decodeSingleQuotedLiteral(body))
  }

  return error('error: invalid quoted literal in jsonpath template')
}

const readExpressionBlock = (
  input: string,
  startIndex: number
): Result<{ content: string; endIndex: number }> => {
  let inSingleQuote = false
  let inDoubleQuote = false
  let escaping = false
  let cursor = startIndex + 1
  let content = ''

  while (cursor < input.length) {
    const char = input[cursor]
    if (escaping) {
      content += char
      escaping = false
      cursor += 1
      continue
    }
    if (char === '\\') {
      content += char
      escaping = true
      cursor += 1
      continue
    }
    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote
      content += char
      cursor += 1
      continue
    }
    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote
      content += char
      cursor += 1
      continue
    }
    if (char === '}' && !inSingleQuote && !inDoubleQuote) {
      return success({ content, endIndex: cursor })
    }
    content += char
    cursor += 1
  }

  return error('error: invalid jsonpath template, missing closing brace')
}

interface ParseFrame {
  nodes: TemplateNode[]
  rangeNode?: Extract<TemplateNode, { type: 'range' }>
}

export const parseKubectlJsonPathTemplate = (
  template: string
): Result<TemplateNode[]> => {
  const rootFrame: ParseFrame = { nodes: [] }
  const stack: ParseFrame[] = [rootFrame]
  let cursor = 0
  let textBuffer = ''

  const flushTextBuffer = (): void => {
    if (textBuffer.length === 0) {
      return
    }
    stack[stack.length - 1].nodes.push({
      type: 'text',
      value: textBuffer
    })
    textBuffer = ''
  }

  while (cursor < template.length) {
    const char = template[cursor]
    if (char !== '{') {
      textBuffer += char
      cursor += 1
      continue
    }

    flushTextBuffer()
    const blockResult = readExpressionBlock(template, cursor)
    if (!blockResult.ok) {
      return blockResult
    }
    cursor = blockResult.value.endIndex + 1

    const expression = blockResult.value.content.trim()
    if (expression.length === 0) {
      continue
    }

    if (expression === 'end') {
      if (stack.length === 1) {
        return error('error: invalid jsonpath template, unexpected end')
      }
      stack.pop()
      continue
    }

    if (expression.startsWith('range ')) {
      const rangeExpression = expression.slice('range '.length).trim()
      if (rangeExpression.length === 0) {
        return error(
          'error: invalid jsonpath template, range expression is empty'
        )
      }
      const rangeNode: Extract<TemplateNode, { type: 'range' }> = {
        type: 'range',
        expression: rangeExpression,
        children: []
      }
      stack[stack.length - 1].nodes.push(rangeNode)
      stack.push({
        nodes: rangeNode.children,
        rangeNode
      })
      continue
    }

    if (
      (expression.startsWith('"') && expression.endsWith('"')) ||
      (expression.startsWith("'") && expression.endsWith("'"))
    ) {
      const decodedLiteralResult = decodeQuotedLiteral(expression)
      if (!decodedLiteralResult.ok) {
        return decodedLiteralResult
      }
      stack[stack.length - 1].nodes.push({
        type: 'literal',
        value: decodedLiteralResult.value
      })
      continue
    }

    stack[stack.length - 1].nodes.push({
      type: 'expression',
      value: expression
    })
  }

  flushTextBuffer()

  if (stack.length !== 1) {
    return error('error: invalid jsonpath template, missing end')
  }

  return success(rootFrame.nodes)
}
