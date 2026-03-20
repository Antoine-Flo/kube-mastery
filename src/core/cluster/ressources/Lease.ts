// ═══════════════════════════════════════════════════════════════════════════
// LEASE MODEL
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Lease model conforming to OpenAPI specification
// Leases are namespaced resources (typically in kube-node-lease namespace)

import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'

// ─── Owner Reference ────────────────────────────────────────────────────────

export interface OwnerReference {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller?: boolean
  blockOwnerDeletion?: boolean
}

// ─── Lease Spec ────────────────────────────────────────────────────────────

export interface LeaseSpec {
  holderIdentity?: string
  leaseDurationSeconds?: number
  acquireTime?: string
  renewTime?: string
  leaseTransitions?: number
}

// ─── Lease Metadata ─────────────────────────────────────────────────────────

interface LeaseMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
  resourceVersion?: string
  uid?: string
  ownerReferences?: OwnerReference[]
}

// ─── Lease Structure ────────────────────────────────────────────────────────

export interface Lease extends KubernetesResource {
  apiVersion: 'coordination.k8s.io/v1'
  kind: 'Lease'
  metadata: LeaseMetadata
  spec: LeaseSpec
}

// ─── Lease Config ──────────────────────────────────────────────────────────

export interface LeaseConfig {
  name: string
  namespace: string
  spec: LeaseSpec
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
  resourceVersion?: string
  uid?: string
  ownerReferences?: OwnerReference[]
}

// ─── Factory Function ──────────────────────────────────────────────────────

export const createLease = (config: LeaseConfig): Lease => {
  const lease: Lease = {
    apiVersion: 'coordination.k8s.io/v1',
    kind: 'Lease',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations }),
      ...(config.resourceVersion && {
        resourceVersion: config.resourceVersion
      }),
      ...(config.uid && { uid: config.uid }),
      ...(config.ownerReferences && { ownerReferences: config.ownerReferences })
    },
    spec: config.spec
  }

  return deepFreeze(lease)
}

// ─── Zod Schema for YAML Validation (internal use only) ──────────────────

const OwnerReferenceSchema = z.object({
  apiVersion: z.string(),
  kind: z.string(),
  name: z.string(),
  uid: z.string(),
  controller: z.boolean().optional(),
  blockOwnerDeletion: z.boolean().optional()
})

const LeaseSpecSchema = z.object({
  holderIdentity: z.string().optional(),
  leaseDurationSeconds: z.number().optional(),
  acquireTime: z.string().optional(),
  renewTime: z.string().optional(),
  leaseTransitions: z.number().optional()
})

const LeaseManifestSchema = z.object({
  apiVersion: z.literal('coordination.k8s.io/v1'),
  kind: z.literal('Lease'),
  metadata: z.object({
    name: z.string().min(1, 'Lease name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional(),
    resourceVersion: z.string().optional(),
    uid: z.string().optional(),
    ownerReferences: z.array(OwnerReferenceSchema).optional()
  }),
  spec: LeaseSpecSchema.optional()
})

/**
 * Parse and validate Lease manifest from YAML
 */
export const parseLeaseManifest = (data: unknown): Result<Lease> => {
  const result = LeaseManifestSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Lease manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data

  const lease: Lease = {
    apiVersion: 'coordination.k8s.io/v1',
    kind: 'Lease',
    metadata: {
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
      creationTimestamp:
        manifest.metadata.creationTimestamp || new Date().toISOString(),
      ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
      ...(manifest.metadata.annotations && {
        annotations: manifest.metadata.annotations
      }),
      ...(manifest.metadata.resourceVersion && {
        resourceVersion: manifest.metadata.resourceVersion
      }),
      ...(manifest.metadata.uid && { uid: manifest.metadata.uid }),
      ...(manifest.metadata.ownerReferences && {
        ownerReferences: manifest.metadata.ownerReferences
      })
    },
    spec: manifest.spec || {}
  }

  return success(deepFreeze(lease))
}
