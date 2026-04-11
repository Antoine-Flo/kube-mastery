import { evaluateKubectlJsonPathValues } from '../../kubectl/commands/output/jsonpath/jsonPathEvaluator'
import {
  error,
  success,
  type Result
} from '../../shared/result'
import type { DrillAssertion } from '../../../content/drills/types'
import type { ValidationQueryPort } from './ValidationQueryPort'

export type AssertionFailureCode =
  | 'resource_not_found'
  | 'field_mismatch'
  | 'field_empty'
  | 'list_value_missing'
  | 'filesystem_file_missing'
  | 'filesystem_file_not_readable'
  | 'filesystem_file_empty'
  | 'filesystem_content_mismatch'

export interface AssertionFailure {
  code: AssertionFailureCode
  message: string
  onFail: string
  observed?: string
}

export type AssertionEvaluation =
  | { passed: true }
  | { passed: false; failure: AssertionFailure }

const valuesToComparableString = (values: unknown[]): string => {
  return values.map((value) => String(value ?? '')).join(' ').trim()
}

const extractComparableValue = (
  payload: unknown,
  expression: string
): Result<string> => {
  const valuesResult = evaluateKubectlJsonPathValues(payload, expression)
  if (!valuesResult.ok) {
    return error(valuesResult.error)
  }
  return success(valuesToComparableString(valuesResult.value))
}

const createFailure = (
  code: AssertionFailureCode,
  onFail: string,
  message: string,
  observed?: string
): AssertionEvaluation => {
  return {
    passed: false,
    failure: {
      code,
      onFail,
      message,
      observed
    }
  }
}

export function evaluateDrillAssertion(
  assertion: DrillAssertion,
  queryPort: ValidationQueryPort
): Result<AssertionEvaluation> {
  if (assertion.type === 'clusterResourceExists') {
    const resourceResult = queryPort.findClusterResource(
      assertion.kind,
      assertion.name,
      assertion.namespace
    )
    if (!resourceResult.ok) {
      return success(
        createFailure(
          'resource_not_found',
          assertion.onFail,
          `Resource not found: ${assertion.kind}/${assertion.name}`
        )
      )
    }
    return success({ passed: true })
  }

  if (
    assertion.type === 'clusterFieldEquals' ||
    assertion.type === 'clusterFieldContains' ||
    assertion.type === 'clusterFieldNotEmpty' ||
    assertion.type === 'clusterFieldsEqual'
  ) {
    const resourceResult = queryPort.findClusterResource(
      assertion.kind,
      assertion.name,
      assertion.namespace
    )
    if (!resourceResult.ok) {
      return success(
        createFailure(
          'resource_not_found',
          assertion.onFail,
          `Resource not found: ${assertion.kind}/${assertion.name}`
        )
      )
    }
    const resource = resourceResult.value

    if (assertion.type === 'clusterFieldsEqual') {
      const leftResult = extractComparableValue(resource, assertion.leftPath)
      if (!leftResult.ok) {
        return error(leftResult.error)
      }
      const rightResult = extractComparableValue(resource, assertion.rightPath)
      if (!rightResult.ok) {
        return error(rightResult.error)
      }
      if (leftResult.value !== rightResult.value) {
        return success(
          createFailure(
            'field_mismatch',
            assertion.onFail,
            'Cluster fields are not equal',
            `${leftResult.value} != ${rightResult.value}`
          )
        )
      }
      return success({ passed: true })
    }

    const valueResult = extractComparableValue(resource, assertion.path)
    if (!valueResult.ok) {
      return error(valueResult.error)
    }

    if (assertion.type === 'clusterFieldEquals') {
      if (valueResult.value !== assertion.value) {
        return success(
          createFailure(
            'field_mismatch',
            assertion.onFail,
            'Cluster field does not equal expected value',
            valueResult.value
          )
        )
      }
      return success({ passed: true })
    }

    if (assertion.type === 'clusterFieldContains') {
      if (!valueResult.value.includes(assertion.value)) {
        return success(
          createFailure(
            'field_mismatch',
            assertion.onFail,
            'Cluster field does not contain expected value',
            valueResult.value
          )
        )
      }
      return success({ passed: true })
    }

    if (valueResult.value.length === 0) {
      return success(
        createFailure(
          'field_empty',
          assertion.onFail,
          'Cluster field is empty',
          valueResult.value
        )
      )
    }
    return success({ passed: true })
  }

  if (assertion.type === 'clusterListFieldContains') {
    const resources = queryPort.listClusterResources(
      assertion.kind,
      assertion.namespace
    )
    const valuesResult = extractComparableValue(
      {
        items: resources
      },
      assertion.path
    )
    if (!valuesResult.ok) {
      return error(valuesResult.error)
    }
    if (!valuesResult.value.includes(assertion.value)) {
      return success(
        createFailure(
          'list_value_missing',
          assertion.onFail,
          'Cluster list field does not contain expected value',
          valuesResult.value
        )
      )
    }
    return success({ passed: true })
  }

  if (
    assertion.type === 'filesystemFileExists' ||
    assertion.type === 'filesystemFileNotEmpty' ||
    assertion.type === 'filesystemFileContains'
  ) {
    const readResult = queryPort.readFile(assertion.path)
    if (!readResult.ok) {
      if (assertion.type === 'filesystemFileExists') {
        return success(
          createFailure(
            'filesystem_file_missing',
            assertion.onFail,
            `Filesystem file is missing: ${assertion.path}`
          )
        )
      }
      return success(
        createFailure(
          'filesystem_file_not_readable',
          assertion.onFail,
          `Filesystem file cannot be read: ${assertion.path}`
        )
      )
    }

    const normalizedContent = readResult.value.trim()
    if (assertion.type === 'filesystemFileNotEmpty') {
      if (normalizedContent.length === 0) {
        return success(
          createFailure(
            'filesystem_file_empty',
            assertion.onFail,
            `Filesystem file is empty: ${assertion.path}`
          )
        )
      }
      return success({ passed: true })
    }

    if (assertion.type === 'filesystemFileContains') {
      if (!normalizedContent.includes(assertion.value)) {
        return success(
          createFailure(
            'filesystem_content_mismatch',
            assertion.onFail,
            'Filesystem file does not contain expected content',
            normalizedContent
          )
        )
      }
      return success({ passed: true })
    }

    return success({ passed: true })
  }

  return error(`Unsupported assertion type: ${String(assertion.type)}`)
}

