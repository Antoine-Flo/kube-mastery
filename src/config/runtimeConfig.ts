import type { ClusterBootstrapConfig } from '../core/cluster/systemBootstrap'
import { DEFAULT_KIND_LIKE_BOOTSTRAP } from '../core/cluster/systemBootstrap'
import {
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from './clusterConfig'

export const SIMULATOR_CLUSTER_NAME = 'sim'
export const CONFORMANCE_CLUSTER_NAME = 'conformance'
export const SIM_POD_PENDING_DELAY_RANGE_MS = {
  minMs: 3000,
  maxMs: 4000
} as const
export const SIM_POD_SCHEDULING_DELAY_RANGE_MS = {
  minMs: 900,
  maxMs: 2200
} as const

interface BootstrapConfigOverrides {
  clusterName?: string
  nodeRoles?: readonly ClusterNodeRole[]
}

const buildBootstrapConfig = (
  overrides: BootstrapConfigOverrides
): ClusterBootstrapConfig => {
  const config: ClusterBootstrapConfig = {
    ...DEFAULT_KIND_LIKE_BOOTSTRAP
  }
  if (overrides.clusterName !== undefined) {
    config.clusterName = overrides.clusterName
  }
  if (overrides.nodeRoles !== undefined) {
    config.nodeRoles = overrides.nodeRoles
  }
  return config
}

export const getSimulatorBootstrapConfig = (): ClusterBootstrapConfig => {
  return buildBootstrapConfig({
    clusterName: SIMULATOR_CLUSTER_NAME,
    nodeRoles: DEFAULT_CLUSTER_NODE_ROLES
  })
}

export const getConformanceBootstrapConfig = (
  clusterName = CONFORMANCE_CLUSTER_NAME,
  nodeRoles: readonly ClusterNodeRole[] = DEFAULT_CLUSTER_NODE_ROLES
): ClusterBootstrapConfig => {
  return buildBootstrapConfig({
    clusterName,
    nodeRoles
  })
}

