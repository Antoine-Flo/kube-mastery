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
  appendTrailingErrors,
  buildListOutput,
  buildNameOutput,
  buildNotFoundErrorMessage,
  isStructuredOutputDirective,
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

  const outputDirectiveResult = validateOutputDirective(
    resolveOutputDirective(parsed.flags, parsed.output),
    ['table', 'json', 'yaml', 'wide', 'name', 'jsonpath', 'custom-columns'],
    '--output must be one of: json|yaml|wide|name|jsonpath|custom-columns'
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
  const isStructuredOutput = isStructuredOutputDirective(outputDirective.kind)
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

  if (outputDirective.kind === 'name') {
    const nameOutput = buildNameOutput(
      resolved.resourceType,
      filtered,
      toResourceKindReference
    )
    return appendTrailingErrors(nameOutput, missingNameErrors)
  }

  if (outputDirective.kind === 'custom-columns') {
    return renderCustomColumnsOutput(
      resolved.resourceType,
      outputDirective,
      allNamespacesFlag,
      filtered,
      missingNameErrors
    )
  }

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
