import { stringify as yamlStringify } from 'yaml'
import type { ParsedCommand } from '../types'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { formatTable } from '../../../shared/formatter'
import {
  API_DISCOVERY_CATALOG,
  type APIResourceDiscovery
} from '../../discovery/apiDiscoveryCatalog'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL API-RESOURCES HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Lists all supported API resources with their shortnames, API version,
// whether they are namespaced, and kind
// Matches the format of real kubectl api-resources output

// ─── Types ───────────────────────────────────────────────────────────────

// ─── Helper Functions ────────────────────────────────────────────────────

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

/**
 * Filter resources by namespaced flag
 */
const filterByNamespaced = (
  resources: APIResourceDiscovery[],
  namespaced?: boolean
): APIResourceDiscovery[] => {
  if (namespaced === undefined) {
    return resources
  }
  return resources.filter((r) => r.namespaced === namespaced)
}

/**
 * Sort resources by specified field
 */
const sortResources = (
  resources: APIResourceDiscovery[],
  sortBy?: string
): APIResourceDiscovery[] => {
  const sorted = [...resources]

  if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy === 'kind') {
    sorted.sort((a, b) => {
      const kindCompare = a.kind.localeCompare(b.kind)
      if (kindCompare !== 0) {
        return kindCompare
      }
      // Secondary sort by name if kinds are equal
      return a.name.localeCompare(b.name)
    })
  }

  return sorted
}

// ─── Formatting Functions ────────────────────────────────────────────────

/**
 * Format shortnames as comma-separated string
 */
const formatShortnames = (shortnames?: string[]): string => {
  if (!shortnames) {
    return ''
  }
  return shortnames.length > 0 ? shortnames.join(',') : ''
}

/**
 * Format namespaced as string ("true" or "false")
 */
const formatNamespaced = (namespaced: boolean): string => {
  return namespaced ? 'true' : 'false'
}

/**
 * Format verbs as comma-separated string
 */
const formatVerbs = (verbs: string[]): string => {
  return verbs ? verbs.join(',') : ''
}

/**
 * Format categories as comma-separated string
 */
const formatCategories = (categories?: string[]): string => {
  return categories ? categories.join(',') : ''
}

/**
 * Format table output (default format)
 * Columns: NAME, SHORTNAMES, APIVERSION, NAMESPACED, KIND
 */
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

  const formatted = formatTable(headers, rows, { spacing: 3, uppercase: false })
  return noHeaders ? formatted.split('\n').slice(1).join('\n') : formatted
}

/**
 * Format wide output (--output wide)
 * Columns: NAME, SHORTNAMES, APIVERSION, NAMESPACED, KIND, VERBS, CATEGORIES
 */
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

  const formatted = formatTable(headers, rows, { spacing: 3, uppercase: false })
  return noHeaders ? formatted.split('\n').slice(1).join('\n') : formatted
}

/**
 * Format name output (--output name)
 * One resource name per line, with API group suffix if not v1
 */
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

/**
 * Format JSON output (--output json)
 * Structure matches metav1.APIResourceList
 */
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

/**
 * Format YAML output (--output yaml)
 * Same structure as JSON but YAML format
 */
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

// ─── Main Handler ────────────────────────────────────────────────────────

/**
 * Handle kubectl api-resources command
 * Supports:
 * - kubectl api-resources (default table format)
 * - kubectl api-resources --output wide (with VERBS and CATEGORIES)
 * - kubectl api-resources --output name (simple name list)
 * - kubectl api-resources --output json (JSON format)
 * - kubectl api-resources --output yaml (YAML format)
 * - kubectl api-resources --namespaced=true (filter namespaced resources)
 * - kubectl api-resources --namespaced=false (filter non-namespaced resources)
 * - kubectl api-resources --sort-by=name (sort by name)
 * - kubectl api-resources --sort-by=kind (sort by kind)
 * - kubectl api-resources --no-headers (hide headers in table format)
 */
export const handleAPIResources = (parsed: ParsedCommand): Result<string> => {
  // Validate --sort-by flag
  const sortBy = parsed.flags['sort-by'] || parsed.flags.sortBy
  if (sortBy && sortBy !== 'name' && sortBy !== 'kind') {
    return error('--sort-by accepts only name or kind')
  }

  // Parse --namespaced flag (can be boolean true/false or string "true"/"false")
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

  // Parse --no-headers flag
  const noHeaders =
    parsed.flags['no-headers'] === true || parsed.flags.noHeaders === true

  // Get output format
  const explicitOutput = parsed.flags.output || parsed.flags['o']
  const outputFormat = explicitOutput
    ? (explicitOutput as string)
    : parsed.output || 'table'

  // Filter resources
  let filteredResources = filterByNamespaced(
    API_DISCOVERY_CATALOG,
    namespacedFilter
  )

  // Sort resources
  filteredResources = sortResources(filteredResources, sortBy as string)

  // Format output based on --output flag
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

  // Default: table format
  return success(formatTableOutput(filteredResources, noHeaders))
}
