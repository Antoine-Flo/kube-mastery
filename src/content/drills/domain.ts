import { parse } from 'yaml'
import type { UiLang } from '../courses/types'
import {
  DRILL_TAG_IDS,
  DRILL_ASSERTION_TYPE_SET,
  DRILL_CLUSTER_RESOURCE_KIND_SET,
  type DrillFile,
  type DrillTask,
  type DrillValidation,
  type DrillAssertion,
  type DrillClusterResourceKind,
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

function parseClusterKind(value: unknown): DrillClusterResourceKind | undefined {
  if (typeof value !== 'string' || !DRILL_CLUSTER_RESOURCE_KIND_SET.has(value)) {
    return undefined
  }
  return value as DrillClusterResourceKind
}

const isObjectRecord = (
  value: unknown
): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

function parseDrillAssertion(value: unknown): DrillAssertion | undefined {
  if (!isObjectRecord(value)) {
    return undefined
  }
  const obj = value
  const type = obj.type
  if (
    typeof type !== 'string' ||
    !DRILL_ASSERTION_TYPE_SET.has(type) ||
    typeof obj.onFail !== 'string'
  ) {
    return undefined
  }

  if (type.startsWith('cluster')) {
    const kind = parseClusterKind(obj.kind)
    if (!kind) {
      return undefined
    }
    const namespace =
      typeof obj.namespace === 'string' ? obj.namespace : undefined

    if (type === 'clusterResourceExists') {
      if (typeof obj.name !== 'string') {
        return undefined
      }
      return { type, onFail: obj.onFail, kind, namespace, name: obj.name }
    }

    if (type === 'clusterFieldEquals' || type === 'clusterFieldContains') {
      if (
        typeof obj.name !== 'string' ||
        typeof obj.path !== 'string' ||
        typeof obj.value !== 'string'
      ) {
        return undefined
      }
      return {
        type,
        onFail: obj.onFail,
        kind,
        namespace,
        name: obj.name,
        path: obj.path,
        value: obj.value
      }
    }

    if (type === 'clusterFieldNotEmpty') {
      if (typeof obj.name !== 'string' || typeof obj.path !== 'string') {
        return undefined
      }
      return {
        type,
        onFail: obj.onFail,
        kind,
        namespace,
        name: obj.name,
        path: obj.path
      }
    }

    if (type === 'clusterFieldsEqual') {
      if (
        typeof obj.name !== 'string' ||
        typeof obj.leftPath !== 'string' ||
        typeof obj.rightPath !== 'string'
      ) {
        return undefined
      }
      return {
        type,
        onFail: obj.onFail,
        kind,
        namespace,
        name: obj.name,
        leftPath: obj.leftPath,
        rightPath: obj.rightPath
      }
    }

    if (type === 'clusterListFieldContains') {
      if (typeof obj.path !== 'string' || typeof obj.value !== 'string') {
        return undefined
      }
      return {
        type,
        onFail: obj.onFail,
        kind,
        namespace,
        path: obj.path,
        value: obj.value
      }
    }
  }

  if (type === 'filesystemFileExists' || type === 'filesystemFileNotEmpty') {
    if (typeof obj.path !== 'string') {
      return undefined
    }
    return {
      type,
      onFail: obj.onFail,
      path: obj.path
    }
  }

  if (type === 'filesystemFileContains') {
    if (typeof obj.path !== 'string' || typeof obj.value !== 'string') {
      return undefined
    }
    return {
      type,
      onFail: obj.onFail,
      path: obj.path,
      value: obj.value
    }
  }

  return undefined
}

function parseDrillValidation(value: unknown): DrillValidation | undefined {
  if (!isObjectRecord(value)) {
    return undefined
  }
  const obj = value
  if (!Array.isArray(obj.assertions)) {
    return undefined
  }
  const assertions: DrillAssertion[] = []
  for (const assertionValue of obj.assertions) {
    const assertion = parseDrillAssertion(assertionValue)
    if (!assertion) {
      return undefined
    }
    assertions.push(assertion)
  }
  if (assertions.length === 0) {
    return undefined
  }
  return { assertions }
}

type ParsedDrillTaskResult =
  | { kind: 'ok'; task: DrillTask }
  | { kind: 'skip' }
  | { kind: 'invalidValidation' }

function parseDrillTask(value: unknown): ParsedDrillTaskResult {
  if (!isObjectRecord(value)) {
    return { kind: 'skip' }
  }
  if (
    typeof value.task !== 'string' ||
    typeof value.command !== 'string' ||
    typeof value.explanation !== 'string'
  ) {
    return { kind: 'skip' }
  }

  const validation = parseDrillValidation(value.validation)
  if (value.validation !== undefined && !validation) {
    return { kind: 'invalidValidation' }
  }
  return {
    kind: 'ok',
    task: {
      task: value.task,
      command: value.command,
      explanation: value.explanation,
      ...(validation && { validation })
    }
  }
}

export function parseDrillFile(rawYaml: string): DrillFile | null {
  let parsed: unknown
  try {
    parsed = parse(rawYaml)
  } catch {
    return null
  }

  if (!isObjectRecord(parsed)) {
    return null
  }

  const obj = parsed

  if (typeof obj.title !== 'string' || !Array.isArray(obj.tasks)) {
    return null
  }

  const tasks: DrillTask[] = []

  for (const item of obj.tasks) {
    const parsedTask = parseDrillTask(item)
    if (parsedTask.kind === 'invalidValidation') {
      return null
    }
    if (parsedTask.kind === 'skip') {
      continue
    }
    tasks.push(parsedTask.task)
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
