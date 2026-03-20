import type { ClusterStateData } from '../../../../../cluster/ClusterState'
import type { ParsedCommand } from '../../../types'
import { toResourceKindReference } from '../../../resourceHelpers'
import { formatKubectlTable, type OutputDirective, renderStructuredPayload } from '../../../output/outputHelpers'
import { renderCustomColumnsTable } from '../../../output/customColumns'
import { applyFilters, noResourcesMessage } from './filters'
import { formatLabelsForDisplay } from './podPresentation'
import { RESOURCE_HANDLERS } from './resourceHandlers'
import {
  buildGenericListOutput,
  isStructuredOutputDirective,
  sanitizeForOutput,
  shapeStructuredItemsForOutput
} from './structuredOutput'
import {
  type ResourceHandler,
  type ResourceWithMetadata,
  type StructuredResource,
  withKubectlTableSpacing
} from './types'

type GetAllResourceType =
  | 'pods'
  | 'services'
  | 'deployments'
  | 'daemonsets'
  | 'replicasets'

const GET_ALL_RESOURCE_ORDER: GetAllResourceType[] = [
  'pods',
  'services',
  'daemonsets',
  'deployments',
  'replicasets'
]

interface GetAllContext {
  allNamespacesFlag: boolean
  effectiveNamespace: string
  filterNamespace: string | undefined
}

const buildGetAllContext = (parsed: ParsedCommand): GetAllContext => {
  const allNamespacesFlag =
    parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
  const effectiveNamespace = parsed.namespace ?? 'default'
  const filterNamespace = allNamespacesFlag ? undefined : effectiveNamespace
  return {
    allNamespacesFlag,
    effectiveNamespace,
    filterNamespace
  }
}

const sortGetAllItems = (
  resourceType: GetAllResourceType,
  items: ResourceWithMetadata[],
  allNamespacesFlag: boolean
): ResourceWithMetadata[] => {
  if (resourceType === 'pods' && allNamespacesFlag) {
    return [...items].sort((left, right) => {
      if (left.metadata.namespace !== right.metadata.namespace) {
        return left.metadata.namespace.localeCompare(right.metadata.namespace)
      }
      return left.metadata.name.localeCompare(right.metadata.name)
    })
  }
  if (resourceType === 'deployments') {
    return [...items].sort((left, right) => {
      return left.metadata.name.localeCompare(right.metadata.name)
    })
  }
  return items
}

const buildGetAllRows = (
  resourceType: GetAllResourceType,
  items: ResourceWithMetadata[],
  handler: ResourceHandler<ResourceWithMetadata>,
  allNamespacesFlag: boolean,
  showLabels: boolean
): string[][] => {
  const rowsSource = sortGetAllItems(resourceType, items, allNamespacesFlag)
  return rowsSource.map((item) => {
    const row = handler.formatRow(item)
    const nameReference = toResourceKindReference(resourceType)
    const rowWithReference = [...row]
    rowWithReference[0] = `${nameReference}/${item.metadata.name}`
    if (showLabels) {
      rowWithReference.push(formatLabelsForDisplay(item.metadata.labels))
    }
    if (allNamespacesFlag) {
      return [item.metadata.namespace, ...rowWithReference]
    }
    return rowWithReference
  })
}

const buildGetAllHeaders = (
  allNamespacesFlag: boolean,
  handler: ResourceHandler<ResourceWithMetadata>,
  showLabels: boolean
): string[] => {
  const headers = [...handler.headers]
  if (showLabels) {
    headers.push('labels')
  }
  if (allNamespacesFlag) {
    return ['namespace', ...headers]
  }
  return headers
}

const buildGetAllTableOptions = (
  allNamespacesFlag: boolean,
  handler: ResourceHandler<ResourceWithMetadata>,
  showLabels: boolean
): { spacing: number; align?: ('left' | 'right')[] } => {
  const namespaceColumns = allNamespacesFlag ? 1 : 0
  const labelsColumns = showLabels ? 1 : 0
  const totalColumns = handler.headers.length + namespaceColumns + labelsColumns
  const align: ('left' | 'right')[] = Array.from(
    { length: totalColumns },
    () => 'left'
  )
  return withKubectlTableSpacing({ align })
}

const buildGetAllSection = (
  state: ClusterStateData,
  parsed: ParsedCommand,
  context: GetAllContext,
  resourceType: GetAllResourceType
): string | undefined => {
  const showLabels = parsed.flags['show-labels'] === true
  const handler = RESOURCE_HANDLERS[
    resourceType
  ] as unknown as ResourceHandler<ResourceWithMetadata>
  const items = handler.getItems(state)
  const filteredItems = applyFilters(
    items,
    context.filterNamespace,
    parsed.selector,
    false,
    parsed.name
  )
  if (filteredItems.length === 0) {
    return undefined
  }

  const headers = buildGetAllHeaders(
    context.allNamespacesFlag,
    handler,
    showLabels
  )
  const rows = buildGetAllRows(
    resourceType,
    filteredItems,
    handler,
    context.allNamespacesFlag,
    showLabels
  )
  const tableOptions = buildGetAllTableOptions(
    context.allNamespacesFlag,
    handler,
    showLabels
  )
  return formatKubectlTable(headers, rows, tableOptions)
}

const collectGetAllItems = (
  state: ClusterStateData,
  parsed: ParsedCommand,
  context: GetAllContext
): Array<{
  resourceType: GetAllResourceType
  items: ResourceWithMetadata[]
}> => {
  const collected: Array<{
    resourceType: GetAllResourceType
    items: ResourceWithMetadata[]
  }> = []
  for (const resourceType of GET_ALL_RESOURCE_ORDER) {
    const handler = RESOURCE_HANDLERS[
      resourceType
    ] as unknown as ResourceHandler<ResourceWithMetadata>
    const items = handler.getItems(state)
    const filteredItems = applyFilters(
      items,
      context.filterNamespace,
      parsed.selector,
      false,
      parsed.name
    )
    if (filteredItems.length > 0) {
      collected.push({
        resourceType,
        items: filteredItems
      })
    }
  }
  return collected
}

export const handleGetAll = (
  state: ClusterStateData,
  parsed: ParsedCommand,
  outputDirective: OutputDirective,
  resourceVersion: string
): string => {
  const context = buildGetAllContext(parsed)
  const collected = collectGetAllItems(state, parsed, context)
  const isStructuredOutput = isStructuredOutputDirective(outputDirective.kind)

  if (isStructuredOutput) {
    const mixedItems = collected.flatMap((entry) => {
      const sanitized = entry.items.map((item) => {
        return sanitizeForOutput(item as unknown as Record<string, unknown>)
      })
      return shapeStructuredItemsForOutput(
        entry.resourceType as StructuredResource,
        sanitized
      )
    })
    if (mixedItems.length === 0) {
      const payload = buildGenericListOutput([], resourceVersion)
      const renderResult = renderStructuredPayload(payload, outputDirective)
      if (!renderResult.ok) {
        return renderResult.error
      }
      return renderResult.value
    }
    const payload = buildGenericListOutput(mixedItems, resourceVersion)
    const renderResult = renderStructuredPayload(payload, outputDirective)
    if (!renderResult.ok) {
      return renderResult.error
    }
    return renderResult.value
  }

  if (outputDirective.kind === 'custom-columns') {
    const spec = outputDirective.customColumnsSpec ?? ''
    const sections: string[] = []
    for (const entry of collected) {
      const sanitized = entry.items.map((item) => {
        return sanitizeForOutput(item as unknown as Record<string, unknown>)
      })
      if (sanitized.length === 0) {
        continue
      }
      const tableResult = renderCustomColumnsTable(spec, sanitized)
      if (!tableResult.ok) {
        return tableResult.error
      }
      sections.push(tableResult.value)
    }
    if (sections.length === 0) {
      return noResourcesMessage(
        context.allNamespacesFlag ? undefined : context.effectiveNamespace,
        false
      )
    }
    return sections.join('\n\n')
  }

  const sections = collected
    .map((entry) => {
      return buildGetAllSection(state, parsed, context, entry.resourceType)
    })
    .filter((section): section is string => {
      return section != null
    })

  if (sections.length === 0) {
    return noResourcesMessage(
      context.allNamespacesFlag ? undefined : context.effectiveNamespace,
      false
    )
  }

  return sections.join('\n\n')
}
