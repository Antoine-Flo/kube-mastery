import { stringify as yamlStringify } from 'yaml'
import type { ParsedCommand } from '../../../types'
import type { Result } from '../../../../../shared/result'
import { error, success } from '../../../../../shared/result'
import { formatKubectlTable } from '../../../output/outputHelpers'
import {
  API_DISCOVERY_CATALOG,
  type APIResourceDiscovery
} from '../../../../discovery/apiDiscoveryCatalog'

const KUBECTL_JSON_INDENT = 4

const extractAPIGroup = (groupVersion: string): string => {
  const parts = groupVersion.split('/')
  if (parts.length > 1) {
    return parts[0]
  }
  return ''
}

const extractVersion = (groupVersion: string): string => {
  const parts = groupVersion.split('/')
  if (parts.length > 1) {
    return parts[1]
  }
  return groupVersion
}

const filterByNamespaced = (
  resources: APIResourceDiscovery[],
  namespaced?: boolean
): APIResourceDiscovery[] => {
  if (namespaced === undefined) {
    return resources
  }
  return resources.filter((resource) => resource.namespaced === namespaced)
}

const filterByApiGroup = (
  resources: APIResourceDiscovery[],
  apiGroup?: string
): APIResourceDiscovery[] => {
  if (apiGroup === undefined) {
    return resources
  }

  return resources.filter((resource) => {
    return extractAPIGroup(resource.groupVersion) === apiGroup
  })
}

const sortResources = (
  resources: APIResourceDiscovery[],
  sortBy?: string
): APIResourceDiscovery[] => {
  const sorted = [...resources]

  if (sortBy === 'name') {
    sorted.sort((left, right) => left.name.localeCompare(right.name))
  } else if (sortBy === 'kind') {
    sorted.sort((left, right) => {
      const kindCompare = left.kind.localeCompare(right.kind)
      if (kindCompare !== 0) {
        return kindCompare
      }
      return left.name.localeCompare(right.name)
    })
  }

  return sorted
}

const formatShortnames = (shortnames?: string[]): string => {
  if (!shortnames) {
    return ''
  }
  return shortnames.length > 0 ? shortnames.join(',') : ''
}

const formatNamespaced = (namespaced: boolean): string => {
  return namespaced ? 'true' : 'false'
}

const formatVerbs = (verbs: string[]): string => {
  return verbs ? verbs.join(',') : ''
}

const formatCategories = (categories?: string[]): string => {
  return categories ? categories.join(',') : ''
}

const formatTableOutput = (
  resources: APIResourceDiscovery[],
  noHeaders = false
): string => {
  const headers = ['NAME', 'SHORTNAMES', 'APIVERSION', 'NAMESPACED', 'KIND']
  const rows = resources.map((resource) => [
    resource.name,
    formatShortnames(resource.shortNames),
    resource.groupVersion,
    formatNamespaced(resource.namespaced),
    resource.kind
  ])

  return formatKubectlTable(headers, rows, {
    spacing: 3,
    uppercase: false,
    noHeaders
  })
}

const formatWideOutput = (
  resources: APIResourceDiscovery[],
  noHeaders = false
): string => {
  const headers = [
    'NAME',
    'SHORTNAMES',
    'APIVERSION',
    'NAMESPACED',
    'KIND',
    'VERBS',
    'CATEGORIES'
  ]
  const rows = resources.map((resource) => [
    resource.name,
    formatShortnames(resource.shortNames),
    resource.groupVersion,
    formatNamespaced(resource.namespaced),
    resource.kind,
    formatVerbs(resource.verbs),
    formatCategories(resource.categories)
  ])

  return formatKubectlTable(headers, rows, {
    spacing: 3,
    uppercase: false,
    noHeaders
  })
}

const formatNameOutput = (resources: APIResourceDiscovery[]): string => {
  const lines: string[] = []

  for (const resource of resources) {
    const group = extractAPIGroup(resource.groupVersion)
    if (group) {
      lines.push(`${resource.name}.${group}`)
    } else {
      lines.push(resource.name)
    }
  }

  return lines.join('\n')
}

const formatJsonOutput = (resources: APIResourceDiscovery[]): string => {
  const apiResourceList = {
    kind: 'APIResourceList',
    apiVersion: 'v1',
    groupVersion: '',
    resources: resources.map((resource) => ({
      name: resource.name,
      singularName: resource.singularName,
      namespaced: resource.namespaced,
      version: extractVersion(resource.groupVersion),
      kind: resource.kind,
      verbs: resource.verbs,
      ...(resource.shortNames ? { shortNames: resource.shortNames } : {}),
      ...(resource.categories ? { categories: resource.categories } : {})
    }))
  }

  return JSON.stringify(apiResourceList, null, KUBECTL_JSON_INDENT)
}

const formatYamlOutput = (resources: APIResourceDiscovery[]): string => {
  const apiResourceList = {
    kind: 'APIResourceList',
    apiVersion: 'v1',
    groupVersion: '',
    resources: resources.map((resource) => ({
      name: resource.name,
      singularName: resource.singularName,
      namespaced: resource.namespaced,
      version: extractVersion(resource.groupVersion),
      kind: resource.kind,
      verbs: resource.verbs,
      ...(resource.shortNames ? { shortNames: resource.shortNames } : {}),
      ...(resource.categories ? { categories: resource.categories } : {})
    }))
  }

  return yamlStringify(apiResourceList).trimEnd()
}

export const handleAPIResources = (parsed: ParsedCommand): Result<string> => {
  const sortBy = parsed.flags['sort-by'] || parsed.flags.sortBy
  const hasApiGroupFlag = Object.prototype.hasOwnProperty.call(
    parsed.flags,
    'api-group'
  )
  const apiGroupFlag = hasApiGroupFlag
    ? parsed.flags['api-group']
    : parsed.flags.apiGroup
  const apiGroup = typeof apiGroupFlag === 'string' ? apiGroupFlag : undefined
  if (sortBy && sortBy !== 'name' && sortBy !== 'kind') {
    return error('--sort-by accepts only name or kind')
  }

  let namespacedFilter: boolean | undefined
  const namespacedFlag = parsed.flags.namespaced
  if (namespacedFlag !== undefined) {
    if (typeof namespacedFlag === 'boolean') {
      namespacedFilter = namespacedFlag
    } else if (namespacedFlag === 'true') {
      namespacedFilter = true
    } else if (namespacedFlag === 'false') {
      namespacedFilter = false
    }
  }

  const noHeaders =
    parsed.flags['no-headers'] === true || parsed.flags.noHeaders === true

  const explicitOutput = parsed.flags.output || parsed.flags['o']
  const outputFormat = explicitOutput
    ? (explicitOutput as string)
    : parsed.output || 'table'

  let filteredResources = filterByNamespaced(
    API_DISCOVERY_CATALOG,
    namespacedFilter
  )
  filteredResources = filterByApiGroup(filteredResources, apiGroup)

  filteredResources = sortResources(filteredResources, sortBy as string)

  if (outputFormat === 'wide') {
    return success(formatWideOutput(filteredResources, noHeaders))
  }

  if (outputFormat === 'name') {
    return success(formatNameOutput(filteredResources))
  }

  if (outputFormat === 'json') {
    return success(formatJsonOutput(filteredResources))
  }

  if (outputFormat === 'yaml') {
    return success(formatYamlOutput(filteredResources))
  }

  return success(formatTableOutput(filteredResources, noHeaders))
}
