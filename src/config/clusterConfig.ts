export type ClusterNodeRole = 'control-plane' | 'worker'

export const DEFAULT_CLUSTER_CONFIG_PATH =
  'src/courses/seeds/clusterConfig/multi-node.yaml'

export const DEFAULT_CLUSTER_NODE_ROLES: readonly ClusterNodeRole[] =
  Object.freeze(['control-plane', 'worker', 'worker'])

