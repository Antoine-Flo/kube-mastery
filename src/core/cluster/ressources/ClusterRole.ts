import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { ClusterScopedNameFactoryConfigBase } from './resourceFactoryConfig'
import type { PolicyRule } from './Role'

export interface ClusterRole {
  apiVersion: 'rbac.authorization.k8s.io/v1'
  kind: 'ClusterRole'
  metadata: {
    name: string
    namespace: ''
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp: string
  }
  rules: PolicyRule[]
}

export interface ClusterRoleConfig extends ClusterScopedNameFactoryConfigBase {
  rules: PolicyRule[]
}

export const createClusterRole = (config: ClusterRoleConfig): ClusterRole => {
  const clusterRole: ClusterRole = {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRole',
    metadata: {
      name: config.name,
      namespace: '',
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    rules: config.rules
  }
  return deepFreeze(clusterRole)
}

const PolicyRuleSchema = z.object({
  apiGroups: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  verbs: z.array(z.string()).min(1),
  resourceNames: z.array(z.string()).optional(),
  nonResourceURLs: z.array(z.string()).optional()
})

const ClusterRoleManifestSchema = z.object({
  apiVersion: z.literal('rbac.authorization.k8s.io/v1'),
  kind: z.literal('ClusterRole'),
  metadata: z.object({
    name: z.string().min(1),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  rules: z.array(PolicyRuleSchema).default([])
})

export const parseClusterRoleManifest = (
  manifest: unknown
): Result<ClusterRole> => {
  const parsed = ClusterRoleManifestSchema.safeParse(manifest)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return error(
      `Invalid ClusterRole manifest: ${firstIssue.path.join('.')}: ${firstIssue.message}`
    )
  }
  return success(
    createClusterRole({
      name: parsed.data.metadata.name,
      labels: parsed.data.metadata.labels,
      annotations: parsed.data.metadata.annotations,
      creationTimestamp: parsed.data.metadata.creationTimestamp,
      rules: parsed.data.rules
    })
  )
}
