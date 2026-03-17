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
}

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

const isExecutionResult = (value: unknown): value is ExecutionResult => {
  if (value == null || typeof value !== 'object') {
    return false
  }
  if (!('ok' in value)) {
    return false
  }
  const okValue = (value as { ok?: unknown }).ok
  return okValue === true || okValue === false
}

export const handleEdit = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  options: EditHandlerOptions = {}
): ExecutionResult => {
  if (options.editorModal == null) {
    return error('error: interactive editor is not available in this environment')
  }

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

  options.editorModal.open(filename, content, (newContent: string) => {
    const parsedEditedResource = parseEditedResource(newContent)
    if (isExecutionResult(parsedEditedResource)) {
      emitAsync(options, parsedEditedResource)
      return
    }

    const editedKind = parsedEditedResource.kind
    if (editedKind !== target.kind) {
      emitAsync(options, error('Error from server (Invalid): kind: field is immutable'))
      return
    }

    const editedName = getMetadataString(parsedEditedResource, 'name')
    if (editedName == null || editedName.length === 0) {
      emitAsync(options, error('error: invalid manifest: missing metadata.name'))
      return
    }
    const nameValidation = validateMetadataNameByKind(target.kind, editedName)
    if (nameValidation != null) {
      emitAsync(options, nameValidation)
      return
    }

    const immutableValidationError = validateImmutableFieldsForEdit(
      target.kind,
      existing.value as unknown as GenericResource,
      parsedEditedResource
    )
    if (immutableValidationError != null) {
      emitAsync(options, error(immutableValidationError))
      return
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
      emitAsync(options, error(updateResult.error))
      return
    }

    emitAsync(options, success(`${toKindReference(target.kind)}/${target.name} edited`))
  })

  return success('')
}
