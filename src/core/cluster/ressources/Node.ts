// ═══════════════════════════════════════════════════════════════════════════
// NODE MODEL
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Node model conforming to OpenAPI specification
// Nodes are cluster-scoped resources (no namespace)

import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'

// ─── Node Address ──────────────────────────────────────────────────────────

export interface NodeAddress {
  type: 'InternalIP' | 'ExternalIP' | 'Hostname'
  address: string
}

// ─── Node Condition ────────────────────────────────────────────────────────

export interface NodeCondition {
  type:
    | 'Ready'
    | 'MemoryPressure'
    | 'DiskPressure'
    | 'PIDPressure'
    | 'NetworkUnavailable'
  status: 'True' | 'False' | 'Unknown'
  lastHeartbeatTime?: string
  lastTransitionTime?: string
  reason?: string
  message?: string
}

// ─── Node System Info ──────────────────────────────────────────────────────

export interface NodeSystemInfo {
  architecture: string
  bootID?: string
  containerRuntimeVersion: string
  kernelVersion: string
  kubeProxyVersion?: string
  kubeletVersion: string
  machineID?: string
  operatingSystem: string
  osImage: string
  systemUUID?: string
  swap?: {
    capacity?: number
  }
}

// ─── Node Spec ──────────────────────────────────────────────────────────────

export interface NodeTaint {
  key: string
  value?: string
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute'
}

export interface NodeSpec {
  podCIDR?: string
  podCIDRs?: string[]
  providerID?: string
  taints?: NodeTaint[]
  unschedulable?: boolean
}

// ─── Node Status ────────────────────────────────────────────────────────────

export interface NodeStatus {
  addresses?: NodeAddress[]
  conditions?: NodeCondition[]
  nodeInfo: NodeSystemInfo
  allocatable?: Record<string, string>
  capacity?: Record<string, string>
  daemonEndpoints?: {
    kubeletEndpoint?: {
      Port?: number
    }
  }
  images?: Array<{
    names?: string[]
    sizeBytes?: number
  }>
  phase?: string
  runtimeHandlers?: Array<{
    name?: string
    features?: Record<string, boolean>
  }>
}

// ─── Node Metadata ──────────────────────────────────────────────────────────
// Nodes are cluster-scoped, so namespace is always empty string

interface NodeMetadata {
  name: string
  namespace: '' // Cluster-scoped resources have empty namespace
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
  resourceVersion?: string
  uid?: string
}

// ─── Node Structure ────────────────────────────────────────────────────────

export interface Node extends KubernetesResource {
  apiVersion: 'v1'
  kind: 'Node'
  metadata: NodeMetadata
  spec: NodeSpec
  status: NodeStatus
}

// ─── Node Config ───────────────────────────────────────────────────────────

export interface NodeConfig {
  name: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
  spec?: NodeSpec
  status: NodeStatus
}

// ─── Factory Function ──────────────────────────────────────────────────────

export const createNode = (config: NodeConfig): Node => {
  const node: Node = {
    apiVersion: 'v1',
    kind: 'Node',
    metadata: {
      name: config.name,
      namespace: '', // Nodes are cluster-scoped
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: config.spec || {},
    status: config.status
  }

  return deepFreeze(node)
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Get node status from conditions
 * Returns 'Ready' if condition type='Ready' has status='True', otherwise 'NotReady'
 */
export const getNodeStatus = (node: Node): string => {
  const readyCondition = node.status.conditions?.find((c) => c.type === 'Ready')
  if (readyCondition && readyCondition.status === 'True') {
    return 'Ready'
  }
  return 'NotReady'
}

/**
 * Get node roles from labels
 * Extracts roles from node-role.kubernetes.io/* labels
 */
export const getNodeRoles = (node: Node): string => {
  const labels = node.metadata.labels || {}

  // Check for control-plane role
  if (labels['node-role.kubernetes.io/control-plane'] !== undefined) {
    return 'control-plane'
  }

  // Check for master role (deprecated but still used)
  if (labels['node-role.kubernetes.io/master'] !== undefined) {
    return 'master'
  }

  // Check for worker role
  if (labels['node-role.kubernetes.io/worker'] !== undefined) {
    return 'worker'
  }

  return '<none>'
}

/**
 * Get internal IP from node addresses
 */
export const getNodeInternalIP = (node: Node): string => {
  const internalIP = node.status.addresses?.find((a) => a.type === 'InternalIP')
  return internalIP?.address || '<none>'
}

/**
 * Get external IP from node addresses
 */
export const getNodeExternalIP = (node: Node): string => {
  const externalIP = node.status.addresses?.find((a) => a.type === 'ExternalIP')
  return externalIP?.address || '<none>'
}

// ─── Zod Schema for YAML Validation (internal use only) ──────────────────

const NodeManifestSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('Node'),
  metadata: z.object({
    name: z.string().min(1, 'Node name is required'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z
    .object({
      podCIDR: z.string().optional(),
      podCIDRs: z.array(z.string()).optional(),
      providerID: z.string().optional(),
      taints: z
        .array(
          z.object({
            key: z.string(),
            value: z.string().optional(),
            effect: z.enum(['NoSchedule', 'PreferNoSchedule', 'NoExecute'])
          })
        )
        .optional(),
      unschedulable: z.boolean().optional()
    })
    .optional(),
  status: z.object({
    addresses: z
      .array(
        z.object({
          type: z.enum(['InternalIP', 'ExternalIP', 'Hostname']),
          address: z.string()
        })
      )
      .optional(),
    conditions: z
      .array(
        z.object({
          type: z.enum([
            'Ready',
            'MemoryPressure',
            'DiskPressure',
            'PIDPressure',
            'NetworkUnavailable'
          ]),
          status: z.enum(['True', 'False', 'Unknown']),
          lastHeartbeatTime: z.string().optional(),
          lastTransitionTime: z.string().optional(),
          reason: z.string().optional(),
          message: z.string().optional()
        })
      )
      .optional(),
    nodeInfo: z.object({
      architecture: z.string(),
      bootID: z.string().optional(),
      containerRuntimeVersion: z.string(),
      kernelVersion: z.string(),
      kubeProxyVersion: z.string().optional(),
      kubeletVersion: z.string(),
      machineID: z.string().optional(),
      operatingSystem: z.string(),
      osImage: z.string(),
      systemUUID: z.string().optional(),
      swap: z
        .object({
          capacity: z.number().optional()
        })
        .optional()
    }),
    allocatable: z.record(z.string(), z.string()).optional(),
    capacity: z.record(z.string(), z.string()).optional(),
    daemonEndpoints: z
      .object({
        kubeletEndpoint: z
          .object({
            Port: z.number().optional()
          })
          .optional()
      })
      .optional(),
    images: z
      .array(
        z.object({
          names: z.array(z.string()).optional(),
          sizeBytes: z.number().optional()
        })
      )
      .optional(),
    phase: z.string().optional(),
    runtimeHandlers: z
      .array(
        z.object({
          name: z.string().optional(),
          features: z.record(z.string(), z.boolean()).optional()
        })
      )
      .optional()
  })
})

/**
 * Parse and validate Node manifest from YAML
 */
export const parseNodeManifest = (data: unknown): Result<Node> => {
  const result = NodeManifestSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Node manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data

  const node = createNode({
    name: manifest.metadata.name,
    ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
    ...(manifest.metadata.annotations && {
      annotations: manifest.metadata.annotations
    }),
    ...(manifest.metadata.creationTimestamp && {
      creationTimestamp: manifest.metadata.creationTimestamp
    }),
    ...(manifest.spec && { spec: manifest.spec }),
    status: manifest.status
  })

  return success(node)
}
