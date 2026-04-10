import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import type { ParsedCommand, Resource } from '../../../types'
import {
  toPluralResourceKindReference,
  toResourceKindReference
} from '../../../resourceCatalog'
import {
  renderStructuredPayload,
  resolveOutputDirective,
  validateOutputDirective
} from '../../../output/outputHelpers'
import { handleGetRaw } from '../../getRaw'
import { applyFieldSelector, applyFilters, noResourcesMessage } from './filters'
import { handleGetAll } from './getAll'
import {
  hasResourceHandler,
  RESOURCE_HANDLERS,
  type GetSupportedResource
} from './resourceHandlers'
import {
  GET_ALLOWED_OUTPUT_KINDS,
  GET_OUTPUT_VALIDATION_ERROR_MESSAGE,
  isStructuredGetPrintSink,
  resolveGetPrintSink
} from './getPrintFlags'
import {
  appendTrailingErrors,
  buildListOutput,
  buildNameOutput,
  buildNotFoundErrorMessage,
  sanitizeForOutput,
  shapeStructuredItemsForOutput
} from './structuredOutput'
import { renderCustomColumnsOutput, renderTableOutput } from './tableRendering'
import type {
  ResourceHandler,
  ResourceWithMetadata,
  StructuredResource
} from './types'

const SPECIAL_HANDLERS: Record<string, () => string> = {}

const resolveQueryNames = (parsed: ParsedCommand): string[] | undefined => {
  if (parsed.names != null && parsed.names.length > 0) {
    return parsed.names
  }
  return undefined
}

const prefixFirstTableColumnWithResourceKind = (
  tableOutput: string,
  resourceType: Resource
): string => {
  const lines = tableOutput.split('\n')
  if (lines.length <= 1) {
    return tableOutput
  }
  const header = lines[0]?.trimStart()
  if (header == null || !header.startsWith('NAME')) {
    return tableOutput
  }
  const resourceReference = toResourceKindReference(resourceType)
  const parseColumns = (line: string): string[] => {
    return line.trim().split(/\s{2,}/)
  }
  const rows = lines.map((line, index) => {
    if (line.trim().length === 0) {
      return []
    }
    const columns = parseColumns(line)
    if (index > 0 && columns.length > 0) {
      const nameValue = columns[0]
      columns[0] = `${resourceReference}/${nameValue}`
    }
    return columns
  })
  const columnCount = rows[0]?.length ?? 0
  if (columnCount === 0) {
    return tableOutput
  }
  const columnWidths = Array.from({ length: columnCount }, (_, columnIndex) => {
    return rows.reduce((maxWidth, row) => {
      const value = row[columnIndex] ?? ''
      return Math.max(maxWidth, value.length)
    }, 0)
  })
  const renderedLines = rows.map((row) => {
    if (row.length === 0) {
      return ''
    }
    return row
      .map((value, columnIndex) => {
        if (columnIndex === row.length - 1) {
          return value
        }
        return value.padEnd(columnWidths[columnIndex], ' ')
      })
      .join('   ')
  })
  return renderedLines.join('\n')
}

const resolveMissingNameErrors = (
  resourceType: Resource,
  queryNames: string[] | undefined,
  baseFiltered: ResourceWithMetadata[]
): {
  filtered: ResourceWithMetadata[]
  missingNameErrors: string[]
} => {
  if (queryNames == null) {
    return {
      filtered: baseFiltered,
      missingNameErrors: []
    }
  }
  const missingNameErrors: string[] = []
  const filtered = queryNames.reduce<ResourceWithMetadata[]>((acc, name) => {
    const matched = baseFiltered.find((resource) => {
      return resource.metadata.name === name
    })
    if (matched == null) {
      missingNameErrors.push(
        buildNotFoundErrorMessage(
          resourceType,
          name,
          toPluralResourceKindReference
        )
      )
      return acc
    }
    return [...acc, matched]
  }, [])
  return {
    filtered,
    missingNameErrors
  }
}

const resolveHandler = (
  resource: Resource | undefined
):
  | {
      resourceType: GetSupportedResource
      handler: ResourceHandler<ResourceWithMetadata>
    }
  | undefined => {
  if (resource == null) {
    return undefined
  }
  if (!hasResourceHandler(resource)) {
    return undefined
  }
  const handler = RESOURCE_HANDLERS[
    resource
  ] as unknown as ResourceHandler<ResourceWithMetadata>
  return {
    resourceType: resource,
    handler
  }
}

const namespaceExistsInState = (
  namespace: string,
  state: ReturnType<ApiServerFacade['snapshotState']>
): boolean => {
  return state.namespaces.items.some((item) => {
    return item.metadata.name === namespace
  })
}

export const handleGet = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  dependencies: {
    getResourceVersion?: () => string
  } = {}
): string => {
  const state = apiServer.snapshotState()
  const getResourceVersion =
    dependencies.getResourceVersion ?? apiServer.getResourceVersion
  const resourceVersion = getResourceVersion?.() ?? ''
  if (typeof parsed.rawPath === 'string') {
    return handleGetRaw(state, parsed.rawPath)
  }

  if (parsed.resourceList != null && parsed.resourceList.length > 0) {
    const renderedOutputs = parsed.resourceList.map((resource) => {
      const output = handleGet(
        apiServer,
        {
          ...parsed,
          resource,
          resourceList: undefined,
          name: undefined,
          names: undefined
        },
        dependencies
      )
      return prefixFirstTableColumnWithResourceKind(output, resource)
    })
    return renderedOutputs.join('\n\n')
  }

  const outputDirectiveResult = validateOutputDirective(
    resolveOutputDirective(parsed.flags, parsed.output),
    [...GET_ALLOWED_OUTPUT_KINDS],
    GET_OUTPUT_VALIDATION_ERROR_MESSAGE
  )
  if (!outputDirectiveResult.ok) {
    return `error: ${outputDirectiveResult.error}`
  }
  const outputDirective = outputDirectiveResult.value

  if (parsed.resource === 'all') {
    return handleGetAll(state, parsed, outputDirective, resourceVersion)
  }

  if (!parsed.resource) {
    return noResourcesMessage('default', false)
  }

  const specialHandler = SPECIAL_HANDLERS[parsed.resource]
  if (specialHandler) {
    return specialHandler()
  }

  const resolved = resolveHandler(parsed.resource)
  if (resolved == null) {
    return noResourcesMessage('default', false)
  }

  const allNamespacesFlag =
    parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
  const effectiveNamespace = parsed.namespace ?? 'default'
  const filterNamespace = allNamespacesFlag ? undefined : effectiveNamespace
  const printSink = resolveGetPrintSink(outputDirective)
  const isStructuredOutput = isStructuredGetPrintSink(printSink)
  const items = resolved.handler.getItems(state)
  const isClusterScoped = resolved.handler.isClusterScoped || false
  const queryNames = resolveQueryNames(parsed)
  const queriesSpecificNames =
    parsed.name != null || (queryNames != null && queryNames.length > 0)
  const hasKnownNamespaces = state.namespaces.items.length > 0
  if (
    !isClusterScoped &&
    filterNamespace != null &&
    queriesSpecificNames &&
    hasKnownNamespaces &&
    namespaceExistsInState(filterNamespace, state) === false
  ) {
    return `Error from server (NotFound): namespaces "${filterNamespace}" not found`
  }
  const baseFiltered = applyFilters(
    items,
    filterNamespace,
    parsed.selector,
    isClusterScoped,
    queryNames == null ? parsed.name : undefined
  )
  const fieldSelectorResult = applyFieldSelector(
    baseFiltered,
    resolved.resourceType,
    parsed.flags['field-selector']
  )
  if (!fieldSelectorResult.ok) {
    return fieldSelectorResult.error
  }
  const byName = resolveMissingNameErrors(
    resolved.resourceType,
    queryNames,
    fieldSelectorResult.value
  )
  const filtered = byName.filtered
  const missingNameErrors = byName.missingNameErrors

  if (filtered.length === 0) {
    if (missingNameErrors.length > 0) {
      return missingNameErrors.join('\n')
    }
    if (resolved.resourceType === 'namespaces' && parsed.name !== undefined) {
      return `Error from server (NotFound): namespaces "${parsed.name}" not found`
    }
    if (isStructuredOutput && parsed.name === undefined) {
      const structuredPayload = buildListOutput(
        resolved.resourceType as StructuredResource,
        [],
        resourceVersion
      )
      const renderResult = renderStructuredPayload(
        structuredPayload,
        outputDirective
      )
      if (!renderResult.ok) {
        return renderResult.error
      }
      return renderResult.value
    }
    return noResourcesMessage(
      allNamespacesFlag ? undefined : effectiveNamespace,
      isClusterScoped
    )
  }

  const sanitized = filtered.map((resource) => {
    return sanitizeForOutput(resource as unknown as Record<string, unknown>)
  })
  if (isStructuredOutput) {
    const asSingleObject =
      queryNames != null ? queryNames.length === 1 : parsed.name !== undefined
    const shaped = shapeStructuredItemsForOutput(
      resolved.resourceType as StructuredResource,
      sanitized
    )
    const structuredPayload = asSingleObject
      ? shaped[0]
      : buildListOutput(
          resolved.resourceType as StructuredResource,
          shaped,
          resourceVersion
        )
    const renderResult = renderStructuredPayload(
      structuredPayload,
      outputDirective
    )
    if (!renderResult.ok) {
      return renderResult.error
    }
    return appendTrailingErrors(renderResult.value, missingNameErrors)
  }

  // Human-readable table (default / wide) before custom-columns and name,
  // matching PrintFlags.ToPrinter order in refs/k8s/kubectl/pkg/cmd/get/get_flags.go.
  if (printSink === 'table') {
    return renderTableOutput({
      resourceType: resolved.resourceType,
      outputDirective,
      parsedWideFlag: parsed.flags.wide === true,
      allNamespacesFlag,
      filtered,
      handler: resolved.handler,
      missingNameErrors,
      showLabels: parsed.flags['show-labels'] === true
    })
  }

  if (printSink === 'custom-columns') {
    return renderCustomColumnsOutput(
      resolved.resourceType,
      outputDirective,
      allNamespacesFlag,
      filtered,
      missingNameErrors
    )
  }

  if (printSink === 'name') {
    const nameOutput = buildNameOutput(
      resolved.resourceType,
      filtered,
      toResourceKindReference
    )
    return appendTrailingErrors(nameOutput, missingNameErrors)
  }

  return `error: unsupported get print sink: ${String(printSink)}`
}
