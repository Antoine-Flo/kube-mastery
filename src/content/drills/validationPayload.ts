import type { DrillAssertion, DrillTask } from './types'

export interface DrillValidationPayloadEntry {
  index: number
  assertions: DrillAssertion[]
}

const isObjectRecord = (
  value: unknown
): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

export function buildDrillValidationPayload(
  tasks: DrillTask[]
): DrillValidationPayloadEntry[] {
  const entries: DrillValidationPayloadEntry[] = []
  for (const [index, task] of tasks.entries()) {
    if (!task.validation) {
      continue
    }
    entries.push({
      index,
      assertions: task.validation.assertions
    })
  }
  return entries
}

export function parseDrillValidationPayload(
  value: unknown
): DrillValidationPayloadEntry[] {
  if (!Array.isArray(value)) {
    return []
  }
  const entries: DrillValidationPayloadEntry[] = []
  for (const item of value) {
    if (!isObjectRecord(item)) {
      continue
    }
    if (
      typeof item.index !== 'number' ||
      !Number.isInteger(item.index) ||
      !Array.isArray(item.assertions)
    ) {
      continue
    }
    entries.push({
      index: item.index,
      assertions: item.assertions as DrillAssertion[]
    })
  }
  return entries
}

