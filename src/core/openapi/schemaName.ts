/**
 * Map Kubernetes resource (apiVersion, kind) to OpenAPI components.schemas name.
 * Must stay aligned with bundled specs under ./specs/.
 */
export const getOpenAPISchemaName = (
  apiVersion: string,
  kind: string
): string => {
  if (apiVersion === 'v1') {
    return `io.k8s.api.core.v1.${kind}`
  }
  if (apiVersion.startsWith('apps/v1')) {
    return `io.k8s.api.apps.v1.${kind}`
  }
  if (apiVersion === 'coordination.k8s.io/v1') {
    return `io.k8s.api.coordination.v1.${kind}`
  }
  if (apiVersion === 'discovery.k8s.io/v1') {
    return `io.k8s.api.discovery.v1.${kind}`
  }
  if (apiVersion === 'networking.k8s.io/v1') {
    return `io.k8s.api.networking.v1.${kind}`
  }
  if (apiVersion === 'storage.k8s.io/v1') {
    return `io.k8s.api.storage.v1.${kind}`
  }
  const normalized = apiVersion.replace('k8s.io/', 'k8s.io.').replace('/', '.')
  return `io.k8s.api.${normalized}.${kind}`
}
