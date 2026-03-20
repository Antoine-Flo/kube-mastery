import type { Pod } from '../../../../../cluster/ressources/Pod'
import type { Resource } from '../../../types'
import type { OutputDirective } from '../../../output/outputHelpers'
import { renderCustomColumnsTable } from '../../../output/customColumns'
import {
  formatLabelsForDisplay,
  getPodDisplayStatus,
  getPodIP,
  getPodNodeName,
  getPodReady,
  getPodRestartsDisplay,
  getUniquePodIPMap
} from './podPresentation'
import { appendTrailingErrors, sanitizeForOutput } from './structuredOutput'
import {
  buildLeftAlign,
  type ResourceHandler,
  type ResourceWithMetadata,
  withKubectlTableSpacing
} from './types'
import { formatAge } from '../../../../../shared/formatter'
import { formatKubectlTable } from '../../../output/outputHelpers'

const isPodsResource = (resourceType: Resource): boolean => {
  return resourceType === ('pods' as Resource)
}

const sortPodsByNamespaceAndName = (
  left: ResourceWithMetadata,
  right: ResourceWithMetadata
): number => {
  if (left.metadata.namespace !== right.metadata.namespace) {
    return left.metadata.namespace.localeCompare(right.metadata.namespace)
  }
  return left.metadata.name.localeCompare(right.metadata.name)
}

const sortDeploymentsByName = (
  left: ResourceWithMetadata,
  right: ResourceWithMetadata
): number => {
  return left.metadata.name.localeCompare(right.metadata.name)
}

const renderPodsAllNamespacesTable = (
  filtered: ResourceWithMetadata[],
  isWide: boolean,
  showLabels: boolean
): string => {
  const sorted = [...filtered].sort(sortPodsByNamespaceAndName)
  const headersAllNamespaces = isWide
    ? [
        'namespace',
        'name',
        'ready',
        'status',
        'restarts',
        'age',
        'ip',
        'node',
        'nominated node',
        'readiness gates'
      ]
    : ['namespace', 'name', 'ready', 'status', 'restarts', 'age']
  if (showLabels) {
    headersAllNamespaces.push('labels')
  }
  const ipMap = getUniquePodIPMap(sorted as Pod[])
  const rowsAllNamespaces = sorted.map((pod) => {
    const podResource = pod as Pod
    if (isWide) {
      const key = `${podResource.metadata.namespace}/${podResource.metadata.name}`
      const row = [
        podResource.metadata.namespace,
        podResource.metadata.name,
        getPodReady(podResource),
        getPodDisplayStatus(podResource),
        getPodRestartsDisplay(podResource),
        formatAge(podResource.metadata.creationTimestamp),
        ipMap.get(key) ?? getPodIP(podResource),
        getPodNodeName(podResource),
        '<none>',
        '<none>'
      ]
      if (showLabels) {
        row.push(formatLabelsForDisplay(podResource.metadata.labels))
      }
      return row
    }
    const row = [
      podResource.metadata.namespace,
      podResource.metadata.name,
      getPodReady(podResource),
      getPodDisplayStatus(podResource),
      getPodRestartsDisplay(podResource),
      formatAge(podResource.metadata.creationTimestamp)
    ]
    if (showLabels) {
      row.push(formatLabelsForDisplay(podResource.metadata.labels))
    }
    return row
  })
  return formatKubectlTable(
    headersAllNamespaces,
    rowsAllNamespaces,
    withKubectlTableSpacing({
      align: buildLeftAlign(headersAllNamespaces.length)
    })
  )
}

const renderAllNamespacesTable = (
  filtered: ResourceWithMetadata[],
  handler: ResourceHandler<ResourceWithMetadata>,
  showLabels: boolean
): string => {
  const rowsSource = [...filtered].sort(sortPodsByNamespaceAndName)
  const rows = (rowsSource.map(handler.formatRow) as string[][]).map(
    (row, index) => {
      const rowWithNamespace = [rowsSource[index].metadata.namespace, ...row]
      if (!showLabels) {
        return rowWithNamespace
      }
      return [
        ...rowWithNamespace,
        formatLabelsForDisplay(rowsSource[index].metadata.labels)
      ]
    }
  )
  const headers = ['namespace', ...handler.headers]
  if (showLabels) {
    headers.push('labels')
  }
  return formatKubectlTable(
    headers,
    rows,
    withKubectlTableSpacing({ align: buildLeftAlign(headers.length) })
  )
}

const renderWideTable = (
  filtered: ResourceWithMetadata[],
  handler: ResourceHandler<ResourceWithMetadata>,
  showLabels: boolean
): string => {
  const headers = [...(handler.headersWide ?? [])]
  const rows = ((handler.formatRowWide != null
    ? filtered.map(handler.formatRowWide)
    : []) as string[][]).map((row, index) => {
    if (!showLabels) {
      return row
    }
    const resource = filtered[index]
    return [...row, formatLabelsForDisplay(resource.metadata.labels)]
  })
  if (showLabels) {
    headers.push('labels')
  }
  return formatKubectlTable(
    headers,
    rows,
    withKubectlTableSpacing({ align: buildLeftAlign(headers.length) })
  )
}

const renderDefaultTable = (
  resourceType: Resource,
  filtered: ResourceWithMetadata[],
  handler: ResourceHandler<ResourceWithMetadata>,
  showLabels: boolean
): string => {
  const rowsSource =
    resourceType === ('deployments' as Resource)
      ? [...filtered].sort(sortDeploymentsByName)
      : filtered
  const rows = (rowsSource.map(handler.formatRow) as string[][]).map(
    (row, index) => {
      if (!showLabels) {
        return row
      }
      const resource = rowsSource[index]
      return [...row, formatLabelsForDisplay(resource.metadata.labels)]
    }
  )
  const headers = [...handler.headers]
  if (showLabels) {
    headers.push('labels')
  }
  const tableOptions = withKubectlTableSpacing({
    align: buildLeftAlign(headers.length)
  })
  return formatKubectlTable(headers, rows, tableOptions)
}

export const renderCustomColumnsOutput = (
  resourceType: Resource,
  outputDirective: OutputDirective,
  allNamespacesFlag: boolean,
  filtered: ResourceWithMetadata[],
  missingNameErrors: string[]
): string => {
  const spec = outputDirective.customColumnsSpec ?? ''
  let ordered = filtered
  if (isPodsResource(resourceType) && allNamespacesFlag) {
    ordered = [...filtered].sort(sortPodsByNamespaceAndName)
  } else if (resourceType === ('deployments' as Resource)) {
    ordered = [...filtered].sort(sortDeploymentsByName)
  }
  const sanitizedForColumns = ordered.map((resource) => {
    return sanitizeForOutput(resource as unknown as Record<string, unknown>)
  })
  const tableResult = renderCustomColumnsTable(spec, sanitizedForColumns)
  if (!tableResult.ok) {
    return tableResult.error
  }
  return appendTrailingErrors(tableResult.value, missingNameErrors)
}

export const renderTableOutput = (options: {
  resourceType: Resource
  outputDirective: OutputDirective
  parsedWideFlag: boolean
  allNamespacesFlag: boolean
  filtered: ResourceWithMetadata[]
  handler: ResourceHandler<ResourceWithMetadata>
  missingNameErrors: string[]
  showLabels: boolean
}): string => {
  const isWide =
    options.outputDirective.kind === 'wide' || options.parsedWideFlag === true
  if (isPodsResource(options.resourceType) && options.allNamespacesFlag) {
    const tableOutput = renderPodsAllNamespacesTable(
      options.filtered,
      isWide,
      options.showLabels
    )
    return appendTrailingErrors(tableOutput, options.missingNameErrors)
  }
  if (options.allNamespacesFlag && !options.handler.isClusterScoped) {
    const tableOutput = renderAllNamespacesTable(
      options.filtered,
      options.handler,
      options.showLabels
    )
    return appendTrailingErrors(tableOutput, options.missingNameErrors)
  }
  if (isWide && options.handler.formatRowWide && options.handler.headersWide) {
    const tableOutput = renderWideTable(
      options.filtered,
      options.handler,
      options.showLabels
    )
    return appendTrailingErrors(tableOutput, options.missingNameErrors)
  }
  const tableOutput = renderDefaultTable(
    options.resourceType,
    options.filtered,
    options.handler,
    options.showLabels
  )
  return appendTrailingErrors(tableOutput, options.missingNameErrors)
}
