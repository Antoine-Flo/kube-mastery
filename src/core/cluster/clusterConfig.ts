import { parse as parseYaml } from 'yaml'
import {
  DEFAULT_CLUSTER_CONFIG_PATH,
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from '../../config/clusterConfig'

export {
  DEFAULT_CLUSTER_CONFIG_PATH,
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
}

interface KindClusterNodeConfig {
  role?: string
}

interface KindClusterConfigFile {
  kind?: string
  apiVersion?: string
  nodes?: KindClusterNodeConfig[]
}

const isClusterNodeRole = (value: string): value is ClusterNodeRole => {
  return value === 'control-plane' || value === 'worker'
}

export const parseClusterNodeRolesFromKindConfig = (
  yamlContent: string
): ClusterNodeRole[] => {
  const parsed = parseYaml(yamlContent) as KindClusterConfigFile | null
  if (parsed == null || typeof parsed !== 'object') {
    throw new Error('Invalid kind cluster config: expected object')
  }

  if (parsed.kind !== 'Cluster') {
    throw new Error('Invalid kind cluster config: kind must be "Cluster"')
  }

  if (!Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error(
      'Invalid kind cluster config: nodes must be a non-empty array'
    )
  }

  const roles = parsed.nodes.map((node, index) => {
    if (typeof node.role !== 'string' || node.role.length === 0) {
      throw new Error(`Invalid node role at index ${index}`)
    }
    if (!isClusterNodeRole(node.role)) {
      throw new Error(`Unsupported node role "${node.role}" at index ${index}`)
    }
    return node.role
  })

  return roles
}

export const buildNodeRoleSlotNames = (
  nodeRoles: readonly ClusterNodeRole[]
): string[] => {
  const roleCounts: Record<ClusterNodeRole, number> = {
    'control-plane': 0,
    worker: 0
  }

  return nodeRoles.map((role) => {
    const currentIndex = roleCounts[role]
    roleCounts[role] = roleCounts[role] + 1

    if (role === 'control-plane') {
      if (currentIndex === 0) {
        return 'control-plane'
      }
      return `control-plane${currentIndex + 1}`
    }

    if (currentIndex === 0) {
      return 'worker'
    }
    return `worker${currentIndex + 1}`
  })
}
