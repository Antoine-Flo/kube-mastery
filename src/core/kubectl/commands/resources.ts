// Kubectl resources: canonical name -> list of aliases
export const KUBECTL_RESOURCES = {
  all: ['all'],
  pods: ['pods', 'pod', 'po'],
  deployments: ['deployments', 'deployment', 'deploy'],
  services: ['services', 'service', 'svc'],
  namespaces: ['namespaces', 'namespace', 'ns'],
  configmaps: ['configmaps', 'configmap', 'cm'],
  secrets: ['secrets', 'secret'],
  nodes: ['nodes', 'node', 'no'],
  daemonsets: ['daemonsets', 'daemonset', 'ds'],
  statefulsets: ['statefulsets', 'statefulset', 'sts'],
  replicasets: ['replicasets', 'replicaset', 'rs'],
  ingresses: ['ingresses', 'ingress', 'ing'],
  ingressclasses: ['ingressclasses', 'ingressclass'],
  persistentvolumes: ['persistentvolumes', 'persistentvolume', 'pv'],
  persistentvolumeclaims: [
    'persistentvolumeclaims',
    'persistentvolumeclaim',
    'pvc'
  ]
} as const

export type KubectlResource = keyof typeof KUBECTL_RESOURCES

const buildResourceAliasMap = (): Record<string, KubectlResource> => {
  const map: Record<string, KubectlResource> = {} as Record<
    string,
    KubectlResource
  >
  for (const [canonical, aliases] of Object.entries(KUBECTL_RESOURCES)) {
    for (const alias of aliases) {
      map[alias] = canonical as KubectlResource
    }
  }
  return map
}

export const RESOURCE_ALIAS_MAP = buildResourceAliasMap()
