import { parse } from 'yaml'
import type { UiLang } from '../courses/types'
import {
  DRILL_TAG_IDS,
  DRILL_ASSERTION_TYPE_SET,
  DRILL_CLUSTER_RESOURCE_KIND_SET,
  type DrillFile,
  type DrillCommandBlock,
  type DrillSolutionCodeLang,
  type DrillSolutionSegment,
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

function parseClusterKind(
  value: unknown
): DrillClusterResourceKind | undefined {
  if (
    typeof value !== 'string' ||
    !DRILL_CLUSTER_RESOURCE_KIND_SET.has(value)
  ) {
    return undefined
  }
  return value as DrillClusterResourceKind
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return value != null && typeof value === 'object'
}

function readOptionalString(
  obj: Record<string, unknown>,
  key: string
): string | undefined {
  const value = obj[key]
  if (typeof value !== 'string') {
    return undefined
  }
  return value
}

function hasRequiredStringFields(
  obj: Record<string, unknown>,
  keys: string[]
): boolean {
  for (const key of keys) {
    if (typeof obj[key] !== 'string') {
      return false
    }
  }
  return true
}

function readOptionalNumber(
  obj: Record<string, unknown>,
  key: string
): number | undefined {
  const value = obj[key]
  if (typeof value !== 'number') {
    return undefined
  }
  return value
}

function parseClusterAssertion(
  obj: Record<string, unknown>,
  type: string,
  onFail: string
): DrillAssertion | undefined {
  const kind = parseClusterKind(obj.kind)
  if (!kind) {
    return undefined
  }
  const base = {
    onFail,
    kind,
    namespace: readOptionalString(obj, 'namespace')
  }

  if (type === 'clusterResourceExists') {
    const name = readOptionalString(obj, 'name')
    if (!name) {
      return undefined
    }
    return { type, ...base, name }
  }
  if (type === 'clusterFieldEquals' || type === 'clusterFieldContains') {
    if (!hasRequiredStringFields(obj, ['name', 'path', 'value'])) {
      return undefined
    }
    return {
      type,
      ...base,
      name: obj.name as string,
      path: obj.path as string,
      value: obj.value as string
    }
  }
  if (type === 'clusterFieldNotEmpty') {
    if (!hasRequiredStringFields(obj, ['name', 'path'])) {
      return undefined
    }
    return {
      type,
      ...base,
      name: obj.name as string,
      path: obj.path as string
    }
  }
  if (type === 'clusterFieldsEqual') {
    if (!hasRequiredStringFields(obj, ['name', 'leftPath', 'rightPath'])) {
      return undefined
    }
    return {
      type,
      ...base,
      name: obj.name as string,
      leftPath: obj.leftPath as string,
      rightPath: obj.rightPath as string
    }
  }
  if (type === 'clusterListFieldContains') {
    if (!hasRequiredStringFields(obj, ['path', 'value'])) {
      return undefined
    }
    return {
      type,
      ...base,
      path: obj.path as string,
      value: obj.value as string
    }
  }
  return undefined
}

function parseFilesystemAssertion(
  obj: Record<string, unknown>,
  type: string,
  onFail: string
): DrillAssertion | undefined {
  if (type === 'filesystemFileExists' || type === 'filesystemFileNotEmpty') {
    const path = readOptionalString(obj, 'path')
    if (!path) {
      return undefined
    }
    return { type, onFail, path }
  }
  if (type === 'filesystemFileContains') {
    if (!hasRequiredStringFields(obj, ['path', 'value'])) {
      return undefined
    }
    return {
      type,
      onFail,
      path: obj.path as string,
      value: obj.value as string
    }
  }
  return undefined
}

function parseDrillAssertion(value: unknown): DrillAssertion | undefined {
  if (!isObjectRecord(value)) {
    return undefined
  }
  const obj = value
  const type = readOptionalString(obj, 'type')
  const onFail = readOptionalString(obj, 'onFail')
  if (!type || !DRILL_ASSERTION_TYPE_SET.has(type) || !onFail) {
    return undefined
  }

  if (type.startsWith('cluster')) {
    return parseClusterAssertion(obj, type, onFail)
  }

  return parseFilesystemAssertion(obj, type, onFail)
}

type ParsedDrillTaskResult =
  | { kind: 'ok'; task: DrillTask }
  | { kind: 'skip' }
  | { kind: 'invalidValidation' }

function parseFrontmatter(
  rawMarkdown: string
): { frontmatter: unknown; body: string } | null {
  const frontmatterMatch = rawMarkdown.match(
    /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/
  )
  if (!frontmatterMatch) {
    return null
  }
  try {
    return {
      frontmatter: parse(frontmatterMatch[1]),
      body: frontmatterMatch[2]
    }
  } catch {
    return null
  }
}

function parseValidationYaml(rawYaml: string): DrillValidation | undefined {
  let parsed: unknown
  try {
    parsed = parse(rawYaml)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed)) {
    return undefined
  }
  const assertions: DrillAssertion[] = []
  for (const value of parsed) {
    const assertion = parseDrillAssertion(value)
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

function fenceLanguageToSolutionLang(
  raw: string
): DrillSolutionCodeLang | undefined {
  const language = raw.trim().toLowerCase()
  if (language === 'bash') {
    return 'bash'
  }
  if (language === 'yaml') {
    return 'yaml'
  }
  return undefined
}

const SOLUTION_FENCE_REGEX = /```([^\n`]*)\n([\s\S]*?)\n```/g

function splitSolutionMarkdownIntoSegments(
  markdown: string
): DrillSolutionSegment[] {
  const segments: DrillSolutionSegment[] = []
  const fenceRegex = new RegExp(
    SOLUTION_FENCE_REGEX.source,
    SOLUTION_FENCE_REGEX.flags
  )
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = fenceRegex.exec(markdown)) !== null) {
    const textBefore = markdown.slice(lastIndex, match.index).trim()
    if (textBefore.length > 0) {
      segments.push({ kind: 'text', markdown: textBefore })
    }
    const lang = fenceLanguageToSolutionLang(match[1])
    const code = match[2].trim()
    if (lang && code.length > 0) {
      segments.push({ kind: 'code', lang, code })
    }
    lastIndex = match.index + match[0].length
  }
  const tail = markdown.slice(lastIndex).trim()
  if (tail.length > 0) {
    segments.push({ kind: 'text', markdown: tail })
  }
  return segments
}

function commandBlocksFromSegments(
  segments: DrillSolutionSegment[]
): DrillCommandBlock[] {
  const blocks: DrillCommandBlock[] = []
  for (const segment of segments) {
    if (segment.kind === 'code') {
      blocks.push({ lang: segment.lang, code: segment.code })
    }
  }
  return blocks
}

function explanationTextFromSegments(
  segments: DrillSolutionSegment[]
): string {
  const parts: string[] = []
  for (const segment of segments) {
    if (segment.kind === 'text') {
      parts.push(segment.markdown)
    }
  }
  return parts.join('\n\n').trim()
}

function splitSectionBySubHeading(
  content: string,
  heading: string
): { before: string; after: string } | null {
  const match = content.match(new RegExp(`^###\\s+${heading}\\s*$`, 'm'))
  if (!match || match.index === undefined) {
    return null
  }
  return {
    before: content.slice(0, match.index).trim(),
    after: content.slice(match.index + match[0].length).trim()
  }
}

function parseMarkdownValidation(
  validationMarkdown: string
): ParsedDrillTaskResult | DrillValidation | undefined {
  if (validationMarkdown.length === 0) {
    return undefined
  }
  const validationFenceMatch = validationMarkdown.match(
    /```yaml\n([\s\S]*?)\n```/
  )
  if (!validationFenceMatch) {
    return undefined
  }
  const validation = parseValidationYaml(validationFenceMatch[1])
  if (!validation) {
    return { kind: 'invalidValidation' }
  }
  return validation
}

function parseMarkdownTask(
  heading: string,
  sectionBody: string
): ParsedDrillTaskResult {
  const solutionParts = splitSectionBySubHeading(sectionBody, 'Solution')
  if (!solutionParts) {
    return { kind: 'skip' }
  }

  const validationParts = splitSectionBySubHeading(
    solutionParts.after,
    'Validation'
  )
  const solutionMarkdown = (
    validationParts ? validationParts.before : solutionParts.after
  ).trim()
  const validationMarkdown = validationParts ? validationParts.after : ''
  const validationOrResult = parseMarkdownValidation(validationMarkdown)
  if (
    validationOrResult &&
    typeof validationOrResult === 'object' &&
    'kind' in validationOrResult
  ) {
    return validationOrResult
  }
  const validation = validationOrResult

  const solutionSegments = splitSolutionMarkdownIntoSegments(solutionMarkdown)
  const commandBlocks = commandBlocksFromSegments(solutionSegments)
  if (commandBlocks.length === 0) {
    return { kind: 'skip' }
  }

  const explanationText = explanationTextFromSegments(solutionSegments)
  const task: DrillTask = {
    task: heading.trim(),
    commandBlocks,
    explanation: explanationText,
    solutionSegments,
    instructionMarkdown:
      solutionParts.before.length > 0 ? solutionParts.before : undefined,
    solutionMarkdown
  }
  if (validation) {
    task.validation = validation
  }
  return { kind: 'ok', task }
}

function parseDrillMarkdownFile(rawMarkdown: string): DrillFile | null {
  const frontmatterResult = parseFrontmatter(rawMarkdown)
  if (!frontmatterResult) {
    return null
  }
  if (!isObjectRecord(frontmatterResult.frontmatter)) {
    return null
  }
  const obj = frontmatterResult.frontmatter
  if (typeof obj.title !== 'string') {
    return null
  }

  const headingRegex = /^##\s+(.+)\s*$/gm
  const headingMatches = Array.from(
    frontmatterResult.body.matchAll(headingRegex)
  )
  if (headingMatches.length === 0) {
    return null
  }

  const tasks: DrillTask[] = []
  for (let index = 0; index < headingMatches.length; index += 1) {
    const current = headingMatches[index]
    const currentIndex = current.index
    if (currentIndex === undefined) {
      continue
    }
    const next = headingMatches[index + 1]
    const nextIndex = next?.index ?? frontmatterResult.body.length
    const start = currentIndex + current[0].length
    const sectionBody = frontmatterResult.body.slice(start, nextIndex).trim()
    const parsedTask = parseMarkdownTask(current[1], sectionBody)
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
    description: readOptionalString(obj, 'description'),
    environment: readOptionalString(obj, 'environment'),
    ckaTargetMinutes: readOptionalNumber(obj, 'ckaTargetMinutes'),
    tasks,
    ...(obj.isDraft === true ? { isDraft: true } : {}),
    ...(obj.comingSoon === true ? { comingSoon: true } : {}),
    ...(obj.isFree === true ? { isFree: true } : {}),
    ...(tag ? { tag } : {})
  }
  return file
}

export function parseDrillFile(rawMarkdown: string): DrillFile | null {
  return parseDrillMarkdownFile(rawMarkdown)
}

export function buildDrillList(
  port: DrillIndexPort,
  lang: UiLang
): DrillListItem[] {
  const drillIds = port.getDrillIds()
  const list: DrillListItem[] = []

  for (const id of drillIds) {
    const file = port.getDrillFile(id, lang)
    if (!file || file.tasks.length === 0) {
      continue
    }
    const isHiddenDraft = file.isDraft === true && file.comingSoon !== true
    if (isHiddenDraft) {
      continue
    }

    list.push({
      id,
      title: file.title,
      description: file.description ?? null,
      totalTasks: file.tasks.length,
      isFree: file.isFree === true,
      comingSoon: file.comingSoon === true,
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
  if (!file || file.isDraft === true || file.comingSoon === true) {
    return null
  }
  const runtimeEnv = port.getDrillRuntimeEnv(drillId)

  return {
    id: drillId,
    title: file.title,
    description: file.description ?? null,
    environment: file.environment,
    ckaTargetMinutes: file.ckaTargetMinutes,
    isFree: file.isFree === true,
    tasks: file.tasks,
    tag: file.tag ?? null,
    runtimeEnv
  }
}
