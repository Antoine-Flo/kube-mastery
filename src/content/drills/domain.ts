import { parse } from 'yaml'
import type { UiLang } from '../courses/types'
import {
  DRILL_TAG_IDS,
  type DrillFile,
  type DrillTask,
  type DrillListItem,
  type DrillDetail,
  type DrillTagId
} from './types'
import type { DrillIndexPort } from './port'

const DRILL_TAG_ID_SET = new Set<string>(DRILL_TAG_IDS)

function parseDrillTag(value: unknown): DrillTagId | undefined {
  if (typeof value !== 'string' || !DRILL_TAG_ID_SET.has(value)) {
    return undefined
  }
  return value as DrillTagId
}

export function parseDrillFile(rawYaml: string): DrillFile | null {
  let parsed: unknown
  try {
    parsed = parse(rawYaml)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const obj = parsed as Record<string, unknown>

  if (typeof obj.title !== 'string' || !Array.isArray(obj.tasks)) {
    return null
  }

  const tasks: DrillTask[] = []

  for (const item of obj.tasks) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as Record<string, unknown>).task === 'string' &&
      typeof (item as Record<string, unknown>).command === 'string' &&
      typeof (item as Record<string, unknown>).explanation === 'string'
    ) {
      tasks.push({
        task: (item as { task: string }).task,
        command: (item as { command: string }).command,
        explanation: (item as { explanation: string }).explanation
      })
    }
  }

  const tag = parseDrillTag(obj.tag)

  const file: DrillFile = {
    title: obj.title,
    description: typeof obj.description === 'string' ? obj.description : undefined,
    environment: typeof obj.environment === 'string' ? obj.environment : undefined,
    ckaTargetMinutes:
      typeof obj.ckaTargetMinutes === 'number' ? obj.ckaTargetMinutes : undefined,
    tasks
  }

  if (tag) {
    file.tag = tag
  }

  return file
}

export function buildDrillList(port: DrillIndexPort, lang: UiLang): DrillListItem[] {
  const drillIds = port.getDrillIds()
  const list: DrillListItem[] = []

  for (const id of drillIds) {
    const file = port.getDrillFile(id, lang)
    if (!file || file.tasks.length === 0) {
      continue
    }

    list.push({
      id,
      title: file.title,
      description: file.description ?? null,
      totalTasks: file.tasks.length,
      tag: file.tag ?? null
    })
  }

  return list
}

export function buildDrillDetail(
  port: DrillIndexPort,
  drillId: string,
  lang: UiLang
): DrillDetail | null {
  const file = port.getDrillFile(drillId, lang)
  if (!file) {
    return null
  }

  return {
    id: drillId,
    title: file.title,
    description: file.description ?? null,
    environment: file.environment,
    ckaTargetMinutes: file.ckaTargetMinutes,
    tasks: file.tasks,
    tag: file.tag ?? null
  }
}
