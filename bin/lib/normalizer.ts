export const normalizeOutput = (output: string): string => {
  let normalized = output
  normalized = normalized.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/g,
    '<timestamp>'
  )
  normalized = normalized.replace(
    /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/g,
    '<timestamp>'
  )
  normalized = normalized.replace(
    /creationTimestamp:\s*[^\n]+/g,
    'creationTimestamp: <timestamp>'
  )
  normalized = normalized.replace(/uid:\s*[a-f0-9-]{36}/gi, 'uid: <uid>')
  normalized = normalized.replace(
    /"uid"\s*:\s*"[a-f0-9-]{36}"/gi,
    '"uid": "<uid>"'
  )
  normalized = normalized.replace(
    /resourceVersion:\s*"\d+"/g,
    'resourceVersion: "<version>"'
  )
  normalized = normalized.replace(
    /"resourceVersion"\s*:\s*"\d+"/g,
    '"resourceVersion": "<version>"'
  )
  normalized = normalized.replace(/\d+s ago/g, 'Xs ago')
  normalized = normalized.replace(/\d+m ago/g, 'Xm ago')
  normalized = normalized.replace(/\d+h ago/g, 'Xh ago')
  normalized = normalized.replace(/\d+d ago/g, 'Xd ago')
  normalized = normalized.replace(
    /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
    '<ip>'
  )
  normalized = normalized.replace(/\b[3-9]\d{4}\b/g, (match: string) => {
    const port = parseInt(match, 10)
    return port > 30000 ? '<port>' : match
  })
  normalized = normalized.replace(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/gm,
    '<timestamp>'
  )
  normalized = normalized.replace(
    /docker:\/\/[a-f0-9]{64}/g,
    'docker://<container-id>'
  )
  normalized = normalized.replace(
    /containerd:\/\/[a-f0-9]{64}/g,
    'containerd://<container-id>'
  )
  normalized = normalized.replace(/kind-worker\d+/g, '<node-name>')
  normalized = normalized.replace(/kind-control-plane/g, '<node-name>')
  return normalized
}
