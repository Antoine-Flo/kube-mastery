import type { Result } from './result'
import { error, success } from './result'

type LabelSelectorOperator =
  | 'Equals'
  | 'NotEquals'
  | 'In'
  | 'NotIn'
  | 'Exists'
  | 'DoesNotExist'

export interface LabelSelectorRequirement {
  key: string
  operator: LabelSelectorOperator
  values: string[]
}

export interface LabelSelector {
  requirements: LabelSelectorRequirement[]
}

export type LegacyLabelSelector = Record<string, string>
export type LabelSelectorLike = LabelSelector | LegacyLabelSelector

const stripMatchingQuotes = (raw: string): string => {
  const trimmed = raw.trim()
  if (trimmed.length < 2) {
    return trimmed
  }
  const startsWithDoubleQuote = trimmed.startsWith('"')
  const endsWithDoubleQuote = trimmed.endsWith('"')
  if (startsWithDoubleQuote && endsWithDoubleQuote) {
    return trimmed.slice(1, -1).trim()
  }
  const startsWithSingleQuote = trimmed.startsWith("'")
  const endsWithSingleQuote = trimmed.endsWith("'")
  if (startsWithSingleQuote && endsWithSingleQuote) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const invalidSelector = (reason: string): Result<never> => {
  return error(`invalid label selector: ${reason}`)
}

const hasOwnLabel = (
  labels: Record<string, string> | undefined,
  key: string
): boolean => {
  if (labels == null) {
    return false
  }
  return Object.prototype.hasOwnProperty.call(labels, key)
}

const isValidLabelKey = (key: string): boolean => {
  if (key.length === 0) {
    return false
  }
  if (/\s/.test(key)) {
    return false
  }
  if (
    key.includes(',') ||
    key.includes('(') ||
    key.includes(')') ||
    key.includes('=') ||
    key.includes('!')
  ) {
    return false
  }
  return true
}

const isValidLabelValue = (value: string): boolean => {
  if (value.length === 0) {
    return false
  }
  if (/\s/.test(value)) {
    return false
  }
  if (value.includes(',')) {
    return false
  }
  return true
}

const splitSelectorTerms = (selector: string): Result<string[]> => {
  const terms: string[] = []
  let current = ''
  let parenthesisDepth = 0
  for (const char of selector) {
    if (char === '(') {
      parenthesisDepth += 1
      current += char
      continue
    }
    if (char === ')') {
      parenthesisDepth -= 1
      if (parenthesisDepth < 0) {
        return invalidSelector('unmatched closing parenthesis')
      }
      current += char
      continue
    }
    if (char === ',' && parenthesisDepth === 0) {
      const normalized = current.trim()
      if (normalized.length === 0) {
        return invalidSelector('empty requirement')
      }
      terms.push(normalized)
      current = ''
      continue
    }
    current += char
  }
  if (parenthesisDepth !== 0) {
    return invalidSelector('unmatched opening parenthesis')
  }
  const normalized = current.trim()
  if (normalized.length === 0) {
    return invalidSelector('empty requirement')
  }
  terms.push(normalized)
  return success(terms)
}

const parseValueList = (rawValues: string): Result<string[]> => {
  const values = rawValues.split(',').map((value) => {
    return stripMatchingQuotes(value).trim()
  })
  if (values.length === 0) {
    return invalidSelector('set-based selector requires at least one value')
  }
  for (const value of values) {
    if (!isValidLabelValue(value)) {
      return invalidSelector(`invalid value "${value}"`)
    }
  }
  return success(values)
}

const parseBinaryRequirement = (
  term: string,
  operatorToken: '!=' | '==' | '=',
  operator: LabelSelectorOperator
): Result<LabelSelectorRequirement> => {
  const splitIndex = term.indexOf(operatorToken)
  if (splitIndex <= 0) {
    return invalidSelector(`invalid requirement "${term}"`)
  }
  const key = stripMatchingQuotes(term.slice(0, splitIndex).trim())
  const rawValue = stripMatchingQuotes(
    term.slice(splitIndex + operatorToken.length).trim()
  )
  if (!isValidLabelKey(key)) {
    return invalidSelector(`invalid key "${key}"`)
  }
  if (!isValidLabelValue(rawValue)) {
    return invalidSelector(`invalid value "${rawValue}"`)
  }
  return success({
    key,
    operator,
    values: [rawValue]
  })
}

const parseSetRequirement = (
  term: string,
  operatorToken: 'in' | 'notin',
  operator: LabelSelectorOperator
): Result<LabelSelectorRequirement> => {
  const regex =
    operatorToken === 'in'
      ? /^([^!=\s(),]+)\s+in\s*\((.*)\)$/
      : /^([^!=\s(),]+)\s+notin\s*\((.*)\)$/
  const match = term.match(regex)
  if (match == null) {
    return invalidSelector(`invalid requirement "${term}"`)
  }
  const key = stripMatchingQuotes(match[1].trim())
  if (!isValidLabelKey(key)) {
    return invalidSelector(`invalid key "${key}"`)
  }
  const valuesResult = parseValueList(match[2])
  if (!valuesResult.ok) {
    return valuesResult
  }
  return success({
    key,
    operator,
    values: valuesResult.value
  })
}

const parseRequirement = (term: string): Result<LabelSelectorRequirement> => {
  const normalizedTerm = term.trim()
  if (normalizedTerm.length === 0) {
    return invalidSelector('empty requirement')
  }

  if (normalizedTerm.startsWith('!')) {
    const key = stripMatchingQuotes(normalizedTerm.slice(1).trim())
    if (!isValidLabelKey(key)) {
      return invalidSelector(`invalid key "${key}"`)
    }
    return success({
      key,
      operator: 'DoesNotExist',
      values: []
    })
  }

  if (/\s+notin\s*/.test(normalizedTerm)) {
    return parseSetRequirement(normalizedTerm, 'notin', 'NotIn')
  }

  if (/\s+in\s*/.test(normalizedTerm)) {
    return parseSetRequirement(normalizedTerm, 'in', 'In')
  }

  if (normalizedTerm.includes('!=')) {
    return parseBinaryRequirement(normalizedTerm, '!=', 'NotEquals')
  }

  if (normalizedTerm.includes('==')) {
    return parseBinaryRequirement(normalizedTerm, '==', 'Equals')
  }

  if (normalizedTerm.includes('=')) {
    return parseBinaryRequirement(normalizedTerm, '=', 'Equals')
  }

  const key = stripMatchingQuotes(normalizedTerm)
  if (!isValidLabelKey(key)) {
    return invalidSelector(`invalid key "${key}"`)
  }
  return success({
    key,
    operator: 'Exists',
    values: []
  })
}

const isAstSelector = (
  selector: LabelSelectorLike
): selector is LabelSelector => {
  return 'requirements' in selector
}

const toRequirements = (
  selector: LabelSelectorLike | undefined
): LabelSelectorRequirement[] => {
  if (selector == null) {
    return []
  }
  if (isAstSelector(selector)) {
    return selector.requirements
  }
  return Object.entries(selector).map(([key, value]) => {
    return {
      key,
      operator: 'Equals' as const,
      values: [value]
    }
  })
}

const matchesRequirement = (
  requirement: LabelSelectorRequirement,
  labels: Record<string, string> | undefined
): boolean => {
  const hasKey = hasOwnLabel(labels, requirement.key)
  const labelValue =
    hasKey && labels != null ? labels[requirement.key] : undefined

  if (requirement.operator === 'Equals') {
    return hasKey && labelValue === requirement.values[0]
  }
  if (requirement.operator === 'NotEquals') {
    return !hasKey || labelValue !== requirement.values[0]
  }
  if (requirement.operator === 'In') {
    if (!hasKey || labelValue == null) {
      return false
    }
    return requirement.values.includes(labelValue)
  }
  if (requirement.operator === 'NotIn') {
    if (!hasKey || labelValue == null) {
      return true
    }
    return !requirement.values.includes(labelValue)
  }
  if (requirement.operator === 'Exists') {
    return hasKey
  }
  return !hasKey
}

const formatRequirement = (requirement: LabelSelectorRequirement): string => {
  if (requirement.operator === 'Equals') {
    return `${requirement.key}=${requirement.values[0]}`
  }
  if (requirement.operator === 'NotEquals') {
    return `${requirement.key}!=${requirement.values[0]}`
  }
  if (requirement.operator === 'In') {
    return `${requirement.key} in (${requirement.values.join(',')})`
  }
  if (requirement.operator === 'NotIn') {
    return `${requirement.key} notin (${requirement.values.join(',')})`
  }
  if (requirement.operator === 'Exists') {
    return requirement.key
  }
  return `!${requirement.key}`
}

export const parseKubectlLabelSelector = (
  selector: string
): Result<LabelSelector> => {
  const normalizedSelector = stripMatchingQuotes(selector)
  if (normalizedSelector.length === 0) {
    return invalidSelector('selector cannot be empty')
  }
  const termsResult = splitSelectorTerms(normalizedSelector)
  if (!termsResult.ok) {
    return termsResult
  }
  const requirements: LabelSelectorRequirement[] = []
  for (const term of termsResult.value) {
    const requirementResult = parseRequirement(term)
    if (!requirementResult.ok) {
      return requirementResult
    }
    requirements.push(requirementResult.value)
  }
  return success({ requirements })
}

export const matchesLabelSelector = (
  selector: LabelSelectorLike | undefined,
  labels: Record<string, string> | undefined
): boolean => {
  const requirements = toRequirements(selector)
  for (const requirement of requirements) {
    if (!matchesRequirement(requirement, labels)) {
      return false
    }
  }
  return true
}

export const toEqualitySelectorMap = (
  selector: LabelSelectorLike
): Result<Record<string, string>> => {
  const requirements = toRequirements(selector)
  const equalitySelector: Record<string, string> = {}
  for (const requirement of requirements) {
    const isEquals = requirement.operator === 'Equals'
    const isSingleIn =
      requirement.operator === 'In' && requirement.values.length === 1
    if (!isEquals && !isSingleIn) {
      return error(
        `error: selector for expose must be equality-based, unsupported expression "${formatRequirement(requirement)}"`
      )
    }
    const value = requirement.values[0]
    const existingValue = equalitySelector[requirement.key]
    if (existingValue != null && existingValue !== value) {
      return error(
        `error: selector for expose has conflicting requirements for key "${requirement.key}"`
      )
    }
    equalitySelector[requirement.key] = value
  }
  return success(equalitySelector)
}
