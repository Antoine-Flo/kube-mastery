import { parse as parseYaml, stringify as yamlStringify } from 'yaml'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { KindToResource, ResourceKind } from '../../../cluster/ClusterState'
import type { EditorModal } from '../../../shell/commands'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { validateMetadataNameByKind } from '../metadataNameValidation'
import type { ParsedCommand, Resource } from '../types'
import {
  isNamespacedResourceKind,
  RESOURCE_KIND_BY_RESOURCE,
  toKindReference,
  toPluralKindReference
} from './resourceHelpers'
import { validateImmutableFieldsForEdit } from './immutableFieldValidation'

type GenericResource = Record<string, unknown>

type EditHandlerOptions = {
  editorModal?: EditorModal
  onAsyncOutput?: (message: string) => void
  preserveFailedEditCopy?: (content: string) => string | undefined
}
const KUBECTL_IDENTITY_CHANGE_ERROR =
  'error: At least one of apiVersion, kind and name was changed'
const RETRY_EDIT_HEADER = [
  "# Please edit the object below. Lines beginning with a '#' will be ignored,",
  '# and an empty file will abort the edit. If an error occurs while saving this file will be',
  '# reopened with the relevant failures.',
  '#'
]

const isNamespacedKind = (kind: ResourceKind): boolean => {
  return isNamespacedResourceKind(kind)
}

const toEditableResource = (resource: unknown): unknown => {
  if (Array.isArray(resource)) {
    return resource.map((item) => toEditableResource(item))
  }
  if (resource == null || typeof resource !== 'object') {
    return resource
  }
  const entries = Object.entries(resource as Record<string, unknown>)
  const filtered = entries
    .filter(([key]) => key !== '_simulator')
    .map(([key, value]) => [key, toEditableResource(value)] as const)
  return Object.fromEntries(filtered)
}

const toYamlDocument = (resource: unknown): string => {
  const yaml = yamlStringify(resource, {
    indentSeq: false,
    aliasDuplicateObjects: false
  }).trimEnd()
  return `${yaml}\n`
}

const parseEditedResource = (
  yamlContent: string
): GenericResource | ExecutionResult => {
  let parsed: unknown
  try {
    parsed = parseYaml(yamlContent)
  } catch (editError) {
    const message =
      editError instanceof Error ? editError.message : 'Unknown YAML parse error'
    return error(`error: YAML parse error: ${message}`)
  }

  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return error('error: edited manifest must be a single YAML object')
  }
  return parsed as GenericResource
}

const resolveEditTarget = (
  parsed: ParsedCommand
): { kind: ResourceKind; name: string } | ExecutionResult => {
  if (parsed.resource == null) {
    return error('error: edit requires a resource type')
  }
  const kind = RESOURCE_KIND_BY_RESOURCE[parsed.resource]
  if (kind == null) {
    return error(`error: edit does not support resource type "${parsed.resource}"`)
  }
  if (parsed.name == null || parsed.name.length === 0) {
    return error('error: edit requires a resource name')
  }
  return {
    kind,
    name: parsed.name
  }
}

const getMetadataString = (
  resource: GenericResource,
  key: 'name' | 'namespace'
): string | undefined => {
  const metadata = resource.metadata
  if (metadata == null || typeof metadata !== 'object') {
    return undefined
  }
  const value = (metadata as Record<string, unknown>)[key]
  if (typeof value !== 'string') {
    return undefined
  }
  return value
}

const createEditorFilename = (kind: ResourceKind, name: string): string => {
  return `${kind.toLowerCase()}-${name}.yaml`
}

const emitAsync = (
  options: EditHandlerOptions,
  output: ExecutionResult
): void => {
  if (options.onAsyncOutput == null) {
    return
  }
  if (output.ok) {
    options.onAsyncOutput(output.value)
    return
  }
  options.onAsyncOutput(output.error)
}

const emitAsyncPreservedCopyNotice = (
  options: EditHandlerOptions,
  newContent: string
): void => {
  const preservedPath = options.preserveFailedEditCopy?.(newContent)
  if (preservedPath == null) {
    return
  }
  emitAsync(
    options,
    success(
      `A copy of your changes has been stored to "${preservedPath}"`
    )
  )
}

const toRetryReason = (errorMessage: string): string => {
  if (errorMessage.startsWith('Error from server (Invalid): ')) {
    return errorMessage.slice('Error from server (Invalid): '.length)
  }
  return errorMessage
}

const stripExistingRetryHeader = (content: string): string => {
  const lines = content.split('\n')
  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    if (line.startsWith('#') || line.trim().length === 0) {
      index += 1
      continue
    }
    break
  }
  return lines.slice(index).join('\n').trimStart()
}

const trimTrailingEmptyLines = (lines: string[]): string[] => {
  let lastNonEmptyIndex = lines.length - 1
  while (lastNonEmptyIndex >= 0) {
    if (lines[lastNonEmptyIndex].trim().length > 0) {
      break
    }
    lastNonEmptyIndex -= 1
  }
  return lines.slice(0, lastNonEmptyIndex + 1)
}

const buildRetryDiffCommentLines = (
  previousContent: string,
  nextContent: string
): string[] => {
  const previousLines = trimTrailingEmptyLines(previousContent.split('\n'))
  const nextLines = trimTrailingEmptyLines(nextContent.split('\n'))
  let firstDiffIndex = 0
  const minLength = Math.min(previousLines.length, nextLines.length)
  while (firstDiffIndex < minLength) {
    if (previousLines[firstDiffIndex] !== nextLines[firstDiffIndex]) {
      break
    }
    firstDiffIndex += 1
  }
  if (firstDiffIndex === previousLines.length && firstDiffIndex === nextLines.length) {
    return []
  }

  let previousTail = previousLines.length - 1
  let nextTail = nextLines.length - 1
  while (previousTail >= firstDiffIndex && nextTail >= firstDiffIndex) {
    if (previousLines[previousTail] !== nextLines[nextTail]) {
      break
    }
    previousTail -= 1
    nextTail -= 1
  }

  const oldStart = firstDiffIndex + 1
  const oldLength = Math.max(1, previousTail - firstDiffIndex + 1)
  const newStart = firstDiffIndex + 1
  const newLength = Math.max(1, nextTail - firstDiffIndex + 1)

  const removedLine = previousLines[firstDiffIndex] ?? ''
  const addedLine = nextLines[firstDiffIndex] ?? ''
  return [
    `# @@ -${oldStart},${oldLength} +${newStart},${newLength} @@`,
    `# - ${removedLine}`,
    `# + ${addedLine}`,
    '#'
  ]
}

const buildRetryEditorContent = (
  resourceReference: string,
  reasons: string[],
  previousContent: string,
  content: string
): string => {
  const reasonLines = reasons.map((reason) => {
    return `# * ${reason}`
  })
  const sanitizedPreviousContent = stripExistingRetryHeader(previousContent)
  const sanitizedContent = stripExistingRetryHeader(content)
  const diffLines = buildRetryDiffCommentLines(
    sanitizedPreviousContent,
    sanitizedContent
  )
  return [
    ...RETRY_EDIT_HEADER,
    `# ${resourceReference} was not valid:`,
    ...reasonLines,
    ...diffLines,
    sanitizedContent
  ].join('\n')
}

const isExecutionErrorResult = (
  value: unknown
): value is { ok: false; error: string } => {
  if (value == null || typeof value !== 'object') {
    return false
  }
  if (!('ok' in value)) {
    return false
  }
  const okValue = (value as { ok?: unknown }).ok
  return okValue === false
}

export const handleEdit = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  options: EditHandlerOptions = {}
): ExecutionResult => {
  if (options.editorModal == null) {
    return error('error: interactive editor is not available in this environment')
  }
  const editorModal = options.editorModal

  const target = resolveEditTarget(parsed)
  if ('ok' in target) {
    return target
  }

  const namespace = parsed.namespace ?? 'default'
  const existing = isNamespacedKind(target.kind)
    ? apiServer.findResource(target.kind, target.name, namespace)
    : apiServer.findResource(target.kind, target.name)
  if (!existing.ok) {
    return error(
      `Error from server (NotFound): ${toPluralKindReference(target.kind)} "${target.name}" not found`
    )
  }

  const editableManifest = toEditableResource(
    existing.value as unknown as GenericResource
  )
  const content = toYamlDocument(editableManifest)
  const filename = createEditorFilename(target.kind, target.name)
  const resourceReference = `${toPluralKindReference(target.kind)} "${target.name}"`
  const invalidResourceError = `error: ${resourceReference} is invalid`
  let hasValidationFailure = false
  let lastInvalidContent: string | undefined

  const openEditorWithContent = (initialContent: string): void => {
    editorModal.open(
      filename,
      initialContent,
      (newContent: string) => {
        const reopenWithError = (errorMessage: string): boolean => {
          hasValidationFailure = true
          lastInvalidContent = newContent
          emitAsync(options, error(invalidResourceError))
          if (errorMessage === KUBECTL_IDENTITY_CHANGE_ERROR) {
            emitAsyncPreservedCopyNotice(options, newContent)
            emitAsync(
              options,
              error('error: Edit cancelled, no valid changes were saved.')
            )
            return true
          }
          const retryContent = buildRetryEditorContent(
            resourceReference,
            [toRetryReason(errorMessage)],
            initialContent,
            newContent
          )
          openEditorWithContent(retryContent)
          return false
        }

        const parsedEditedResource = parseEditedResource(newContent)
        if (isExecutionErrorResult(parsedEditedResource)) {
          return reopenWithError(parsedEditedResource.error)
        }

        const immutableValidationError = validateImmutableFieldsForEdit(
          target.kind,
          existing.value as unknown as GenericResource,
          parsedEditedResource
        )
        if (immutableValidationError != null) {
          return reopenWithError(immutableValidationError)
        }

        const editedName = getMetadataString(parsedEditedResource, 'name')
        if (editedName == null || editedName.length === 0) {
          return reopenWithError('error: invalid manifest: missing metadata.name')
        }
        const nameValidation = validateMetadataNameByKind(target.kind, editedName)
        if (nameValidation != null && !nameValidation.ok) {
          return reopenWithError(nameValidation.error)
        }

        const updateResult = isNamespacedKind(target.kind)
          ? apiServer.updateResource(
              target.kind,
              target.name,
              parsedEditedResource as unknown as KindToResource<typeof target.kind>,
              namespace
            )
          : apiServer.updateResource(
              target.kind,
              target.name,
              parsedEditedResource as unknown as KindToResource<typeof target.kind>
            )
        if (!updateResult.ok) {
          return reopenWithError(updateResult.error)
        }

        emitAsync(options, success(`${toKindReference(target.kind)}/${target.name} edited`))
        return true
      },
      () => {
        if (!hasValidationFailure) {
          return
        }
        if (lastInvalidContent != null) {
          emitAsyncPreservedCopyNotice(options, lastInvalidContent)
        }
        emitAsync(
          options,
          error('error: Edit cancelled, no valid changes were saved.')
        )
      }
    )
  }

  openEditorWithContent(content)

  return success('')
}
