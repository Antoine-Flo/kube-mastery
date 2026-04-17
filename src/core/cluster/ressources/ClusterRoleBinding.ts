import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { ClusterScopedNameFactoryConfigBase } from './resourceFactoryConfig'
import type { RoleRef, Subject } from './RoleBinding'

export interface ClusterRoleBinding {
  apiVersion: 'rbac.authorization.k8s.io/v1'
  kind: 'ClusterRoleBinding'
  metadata: {
    name: string
    namespace: ''
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp: string
  }
  roleRef: RoleRef
  subjects: Subject[]
}

export interface ClusterRoleBindingConfig
  extends ClusterScopedNameFactoryConfigBase {
  roleRef: RoleRef
  subjects: Subject[]
}

export const createClusterRoleBinding = (
  config: ClusterRoleBindingConfig
): ClusterRoleBinding => {
  const clusterRoleBinding: ClusterRoleBinding = {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'ClusterRoleBinding',
    metadata: {
      name: config.name,
      namespace: '',
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    roleRef: config.roleRef,
    subjects: config.subjects
  }
  return deepFreeze(clusterRoleBinding)
}

const SubjectSchema = z.object({
  kind: z.enum(['ServiceAccount', 'User', 'Group']),
  name: z.string().min(1),
  namespace: z.string().optional(),
  apiGroup: z.literal('rbac.authorization.k8s.io').optional()
})

const RoleRefSchema = z.object({
  apiGroup: z.literal('rbac.authorization.k8s.io'),
  kind: z.enum(['Role', 'ClusterRole']),
  name: z.string().min(1)
})

const ClusterRoleBindingManifestSchema = z.object({
  apiVersion: z.literal('rbac.authorization.k8s.io/v1'),
  kind: z.literal('ClusterRoleBinding'),
  metadata: z.object({
    name: z.string().min(1),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  roleRef: RoleRefSchema,
  subjects: z.array(SubjectSchema).default([])
})

export const parseClusterRoleBindingManifest = (
  manifest: unknown
): Result<ClusterRoleBinding> => {
  const parsed = ClusterRoleBindingManifestSchema.safeParse(manifest)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return error(
      `Invalid ClusterRoleBinding manifest: ${firstIssue.path.join('.')}: ${firstIssue.message}`
    )
  }
  return success(
    createClusterRoleBinding({
      name: parsed.data.metadata.name,
      labels: parsed.data.metadata.labels,
      annotations: parsed.data.metadata.annotations,
      creationTimestamp: parsed.data.metadata.creationTimestamp,
      roleRef: parsed.data.roleRef,
      subjects: parsed.data.subjects
    })
  )
}
