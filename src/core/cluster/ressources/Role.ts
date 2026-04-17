import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

export interface PolicyRule {
  apiGroups?: string[]
  resources?: string[]
  verbs: string[]
  resourceNames?: string[]
  nonResourceURLs?: string[]
}

export interface Role {
  apiVersion: 'rbac.authorization.k8s.io/v1'
  kind: 'Role'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp: string
  }
  rules: PolicyRule[]
}

export interface RoleConfig extends NamespacedFactoryConfigBase {
  rules: PolicyRule[]
}

export const createRole = (config: RoleConfig): Role => {
  const role: Role = {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'Role',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    rules: config.rules
  }
  return deepFreeze(role)
}

const PolicyRuleSchema = z.object({
  apiGroups: z.array(z.string()).optional(),
  resources: z.array(z.string()).optional(),
  verbs: z.array(z.string()).min(1),
  resourceNames: z.array(z.string()).optional(),
  nonResourceURLs: z.array(z.string()).optional()
})

const RoleManifestSchema = z.object({
  apiVersion: z.literal('rbac.authorization.k8s.io/v1'),
  kind: z.literal('Role'),
  metadata: z.object({
    name: z.string().min(1),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  rules: z.array(PolicyRuleSchema).default([])
})

export const parseRoleManifest = (manifest: unknown): Result<Role> => {
  const parsed = RoleManifestSchema.safeParse(manifest)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return error(
      `Invalid Role manifest: ${firstIssue.path.join('.')}: ${firstIssue.message}`
    )
  }
  return success(
    createRole({
      name: parsed.data.metadata.name,
      namespace: parsed.data.metadata.namespace,
      labels: parsed.data.metadata.labels,
      annotations: parsed.data.metadata.annotations,
      creationTimestamp: parsed.data.metadata.creationTimestamp,
      rules: parsed.data.rules
    })
  )
}
