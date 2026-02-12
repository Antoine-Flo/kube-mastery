// ═══════════════════════════════════════════════════════════════════════════
// OUTPUT NORMALIZER
// ═══════════════════════════════════════════════════════════════════════════
// Normalize kubectl outputs to make golden files stable (timestamps, UIDs, etc.)

/**
 * Normalize kubectl output by replacing dynamic values with placeholders
 * This makes golden files stable across different runs
 */
export const normalizeOutput = (output: string): string => {
  let normalized = output

  // Normalize timestamps (ISO format)
  normalized = normalized.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g,
    '<timestamp>'
  )
  normalized = normalized.replace(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g,
    '<timestamp>'
  )

  // Normalize creationTimestamp in YAML/JSON
  normalized = normalized.replace(
    /creationTimestamp:\s*[^\n]+/g,
    'creationTimestamp: <timestamp>'
  )

  // Normalize UIDs (UUID format: 8-4-4-4-12 hex digits)
  normalized = normalized.replace(/uid:\s*[a-f0-9-]{36}/gi, 'uid: <uid>')
  normalized = normalized.replace(
    /"uid"\s*:\s*"[a-f0-9-]{36}"/gi,
    '"uid": "<uid>"'
  )

  // Normalize resourceVersions
  normalized = normalized.replace(
    /resourceVersion:\s*"\d+"/g,
    'resourceVersion: "<version>"'
  )
  normalized = normalized.replace(
    /"resourceVersion"\s*:\s*"\d+"/g,
    '"resourceVersion": "<version>"'
  )

  // Normalize ages (time ago format)
  normalized = normalized.replace(/\d+s ago/g, 'Xs ago')
  normalized = normalized.replace(/\d+m ago/g, 'Xm ago')
  normalized = normalized.replace(/\d+h ago/g, 'Xh ago')
  normalized = normalized.replace(/\d+d ago/g, 'Xd ago')

  // Normalize IP addresses
  normalized = normalized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    '<ip>'
  )

  // Normalize ephemeral ports (ports > 30000, typically 5 digits)
  normalized = normalized.replace(/\b[3-9]\d{4}\b/g, (match: string) => {
    const port = parseInt(match, 10)
    return port > 30000 ? '<port>' : match
  })

  // Normalize timestamps in log lines
  normalized = normalized.replace(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/gm,
    '<timestamp>'
  )

  // Normalize container IDs (docker/k8s format)
  normalized = normalized.replace(
    /docker:\/\/[a-f0-9]{64}/g,
    'docker://<container-id>'
  )
  normalized = normalized.replace(
    /containerd:\/\/[a-f0-9]{64}/g,
    'containerd://<container-id>'
  )

  // Normalize node names (kind clusters use specific patterns)
  normalized = normalized.replace(/kind-worker\d+/g, '<node-name>')
  normalized = normalized.replace(/kind-control-plane/g, '<node-name>')

  return normalized
}
