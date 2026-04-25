export const RBAC_API_GROUP = 'rbac.authorization.k8s.io' as const

const RBAC_NAME_INVALID_VALUES = new Set(['.', '..'])

/**
 * Kubernetes RBAC names are validated with path segment rules.
 * This keeps parity for common invalid inputs such as "/" and "%".
 */
export const isValidRbacName = (value: string): boolean => {
  if (value.length === 0) {
    return false
  }
  if (RBAC_NAME_INVALID_VALUES.has(value)) {
    return false
  }
  if (value.includes('/')) {
    return false
  }
  if (value.includes('%')) {
    return false
  }
  return true
}

type ValidationIssue = {
  path: PropertyKey[]
  message: string
}

const getPathValue = (manifest: unknown, path: PropertyKey[]): unknown => {
  let current: unknown = manifest
  for (const segment of path) {
    if (current == null || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[String(segment)]
  }
  return current
}

const stringifyIssuePath = (path: PropertyKey[]): string => {
  return path
    .map((segment, index) => {
      if (typeof segment === 'number') {
        return index === 0 ? String(segment) : `[${segment}]`
      }
      if (typeof segment === 'symbol') {
        return index === 0 ? String(segment) : `.${String(segment)}`
      }
      return index === 0 ? segment : `.${segment}`
    })
    .join('')
}

const formatSupportedValues = (values: string[]): string => {
  return values.map((value) => `"${value}"`).join(', ')
}

export const formatRbacManifestValidationError = (
  resourceKind: 'RoleBinding' | 'ClusterRoleBinding',
  manifest: unknown,
  issue: ValidationIssue
): string => {
  const issuePath = stringifyIssuePath(issue.path)
  const issueValue = getPathValue(manifest, issue.path)
  const issueValueLabel =
    typeof issueValue === 'string' ? `"${issueValue}"` : JSON.stringify(issueValue)

  if (issuePath === 'roleRef.apiGroup') {
    return `Invalid ${resourceKind} manifest: ${issuePath}: Unsupported value: ${issueValueLabel}: supported values: ${formatSupportedValues([RBAC_API_GROUP])}`
  }
  if (issuePath === 'roleRef.kind') {
    const supportedKinds =
      resourceKind === 'ClusterRoleBinding'
        ? ['ClusterRole']
        : ['Role', 'ClusterRole']
    return `Invalid ${resourceKind} manifest: ${issuePath}: Unsupported value: ${issueValueLabel}: supported values: ${formatSupportedValues(supportedKinds)}`
  }
  if (issuePath === 'roleRef.name') {
    return `Invalid ${resourceKind} manifest: ${issuePath}: Invalid value: ${issueValueLabel}: must be a valid RBAC path segment name`
  }
  if (issuePath.endsWith('.apiGroup') && issuePath.startsWith('subjects[')) {
    const kindPath = [...issue.path.slice(0, -1), 'kind']
    const subjectKind = getPathValue(manifest, kindPath)
    const supportedApiGroups =
      subjectKind === 'ServiceAccount' ? [''] : [RBAC_API_GROUP]
    return `Invalid ${resourceKind} manifest: ${issuePath}: Unsupported value: ${issueValueLabel}: supported values: ${formatSupportedValues(supportedApiGroups)}`
  }
  if (issuePath.endsWith('.namespace') && issuePath.startsWith('subjects[')) {
    return `Invalid ${resourceKind} manifest: ${issuePath}: Required value`
  }
  return `Invalid ${resourceKind} manifest: ${issuePath}: ${issue.message}`
}
