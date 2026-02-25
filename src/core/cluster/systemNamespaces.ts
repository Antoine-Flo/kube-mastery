import { createNamespace, type Namespace } from './ressources/Namespace'

export const SYSTEM_NAMESPACE_NAMES = [
  'default',
  'kube-system',
  'kube-public',
  'kube-node-lease',
  'local-path-storage'
] as const

export type SystemNamespaceName = (typeof SYSTEM_NAMESPACE_NAMES)[number]

export const createSystemNamespaces = (
  creationTimestamp?: string
): Namespace[] => {
  return SYSTEM_NAMESPACE_NAMES.map((name) => {
    return createNamespace({
      name,
      creationTimestamp,
      labels: {
        'kubernetes.io/metadata.name': name
      }
    })
  })
}

export const isSystemNamespace = (name: string): boolean => {
  return SYSTEM_NAMESPACE_NAMES.includes(name as SystemNamespaceName)
}
