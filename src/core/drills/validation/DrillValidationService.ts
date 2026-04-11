import type { DrillAssertion } from '../../../content/drills/types'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import {
  evaluateDrillAssertion,
  type AssertionEvaluation
} from './AssertionEngine'
import type { ValidationQueryPort } from './ValidationQueryPort'

export interface TaskValidationRunResult {
  index: number
  passed: boolean
  errorMessage?: string
}

export interface ValidationEntryInput {
  index: number
  assertions: DrillAssertion[]
}

export interface DrillValidationRunResult {
  allPassed: boolean
  tasks: TaskValidationRunResult[]
}

export interface DrillValidationServiceOptions {
  retryTimeoutMs?: number
  retryIntervalMs?: number
  minSuccessDelayMs?: number
}

const DEFAULT_RETRY_TIMEOUT_MS = 500
const DEFAULT_RETRY_INTERVAL_MS = 250
const DEFAULT_MIN_SUCCESS_DELAY_MS = 100

const wait = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

const resolveErrorMessage = (evaluation: AssertionEvaluation): string => {
  if (evaluation.passed) {
    return ''
  }
  return evaluation.failure.onFail
}

export class DrillValidationService {
  private readonly retryTimeoutMs: number
  private readonly retryIntervalMs: number
  private readonly minSuccessDelayMs: number
  private readonly queryPort: ValidationQueryPort

  constructor(
    queryPort: ValidationQueryPort,
    options: DrillValidationServiceOptions = {}
  ) {
    this.queryPort = queryPort
    this.retryTimeoutMs = options.retryTimeoutMs ?? DEFAULT_RETRY_TIMEOUT_MS
    this.retryIntervalMs =
      options.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS
    this.minSuccessDelayMs =
      options.minSuccessDelayMs ?? DEFAULT_MIN_SUCCESS_DELAY_MS
  }

  private async evaluateWithRetry(
    entry: ValidationEntryInput
  ): Promise<Result<AssertionEvaluation>> {
    if (entry.assertions.length === 0) {
      return success({ passed: true })
    }

    const startedAt = Date.now()
    while (true) {
      let failedEvaluation: Result<AssertionEvaluation> | null = null
      for (const assertion of entry.assertions) {
        const evaluationResult = evaluateDrillAssertion(assertion, this.queryPort)
        if (!evaluationResult.ok) {
          failedEvaluation = evaluationResult
          break
        }
        if (!evaluationResult.value.passed) {
          failedEvaluation = evaluationResult
          break
        }
      }
      if (!failedEvaluation) {
        return success({ passed: true })
      }
      if (!failedEvaluation.ok) {
        return failedEvaluation
      }

      const elapsedMs = Date.now() - startedAt
      if (elapsedMs >= this.retryTimeoutMs) {
        return success(failedEvaluation.value)
      }
      await wait(this.retryIntervalMs)
    }
  }

  async run(
    entries: ValidationEntryInput[]
  ): Promise<Result<DrillValidationRunResult>> {
    const taskResults: TaskValidationRunResult[] = []
    let allPassed = true

    for (const entry of entries) {
      const runStartedAt = Date.now()
      const evaluationResult = await this.evaluateWithRetry(entry)
      if (!evaluationResult.ok) {
        return error(evaluationResult.error)
      }
      const passed = evaluationResult.value.passed
      if (passed) {
        const runElapsedMs = Date.now() - runStartedAt
        const remainingDelayMs = this.minSuccessDelayMs - runElapsedMs
        if (remainingDelayMs > 0) {
          await wait(remainingDelayMs)
        }
      }
      if (!passed) {
        allPassed = false
      }
      taskResults.push({
        index: entry.index,
        passed,
        errorMessage: passed ? undefined : resolveErrorMessage(evaluationResult.value)
      })
    }

    return success({
      allPassed,
      tasks: taskResults
    })
  }
}

