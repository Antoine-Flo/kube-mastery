export const normalizeForParityMatch = (value: string): string => {
  const lines = value
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
  return lines.join('\n')
}

const normalizeNoResourcesChannelForParity = (value: string): string | null => {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }
  const noResourcesPattern = /^No resources found(?: in .+ namespace\.)?$/
  if (!noResourcesPattern.test(trimmed)) {
    return null
  }
  return trimmed
}

export const normalizeStdStreamsForParity = (
  stdout: string,
  stderr: string
): { stdout: string; stderr: string } => {
  const noResourcesStdout = normalizeNoResourcesChannelForParity(stdout)
  const noResourcesStderr = normalizeNoResourcesChannelForParity(stderr)
  if (noResourcesStdout == null && noResourcesStderr == null) {
    return { stdout, stderr }
  }
  const normalizedNoResources = noResourcesStdout ?? noResourcesStderr ?? ''
  return { stdout: normalizedNoResources, stderr: '' }
}

export const stripDynamicAgeValuesForParity = (value: string): string => {
  return value.replace(/\b\d+[smhdwy](?:\d+[smhdwy])*\b/g, '<age>')
}

const stripKubectlLastAppliedYamlNoise = (value: string): string => {
  return value
    .replace(
      /\n  annotations:\n    kubectl\.kubernetes\.io\/last-applied-configuration: \|[\s\S]*?(?=\n  [a-z])/g,
      ''
    )
    .replace(/\n  generation: \d+\n/g, '\n')
}

const normalizeDynamicTokensForParity = (value: string): string => {
  const withoutApplyNoise = stripKubectlLastAppliedYamlNoise(value)
  return withoutApplyNoise
    .replace(/^Created on:\s+.*$/gm, 'Created on:   <timestamp>')
    .replace(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
      '<timestamp>'
    )
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '<ip>')
    .replace(/:\d+\/TCP/g, ':<port>/TCP')
    .replace(/:\d+\/UDP/g, ':<port>/UDP')
    .replace(
      /(resourceVersion:\s*["']?)[^"'\n]+(["']?)/gi,
      '$1<resource-version>$2'
    )
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      '<uid>'
    )
    .replace(/\bid:\s+\d+\b/gi, 'id: <id>')
    .replace(
      /\bresource version:\s*\d+\b/gi,
      'resource version: <resource-version>'
    )
    .replace(
      /\bresourceVersion:\s*["']?[^"'\n]+["']?/g,
      'resourceVersion: <resource-version>'
    )
    .replace(/^  resourceVersion:\s*.+$/gm, '')
    .replace(/^  uid:\s*.+$/gm, '')
    .replace(
      /Resource Version:\s+<unknown>/gi,
      'resource version: <resource-version>'
    )
    .replace(/UID:\s+<unknown>/gi, 'UID:                 <uid>')
}

export const normalizeKubectlCommandStdoutForParity = (
  _command: string,
  stdout: string
): string => {
  return normalizeDynamicTokensForParity(stdout)
}

export const normalizeKubectlCommandStderrForParity = (
  _command: string,
  stderr: string
): string => {
  const filtered = stderr
    .split('\n')
    .filter((line) => {
      const isShortNamePriorityWarning =
        line.startsWith('Warning: short name "') &&
        line.includes('could also match lower priority resource')
      if (isShortNamePriorityWarning) {
        return false
      }
      return true
    })
    .join('\n')
  return normalizeDynamicTokensForParity(filtered)
}
