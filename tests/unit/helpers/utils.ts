// Re-export from source for tests
export { createClusterStateData } from '../../../src/core/cluster/ClusterState'

export const decodeBase64 = (base64: string): string => {
  if (base64 === '') {
    return ''
  }
  const binString = atob(base64)
  const bytes = Uint8Array.from(binString, (m) => m.codePointAt(0)!)
  return new TextDecoder().decode(bytes)
}
