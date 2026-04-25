import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { ClusterScopedNameFactoryConfigBase } from './resourceFactoryConfig'
import {
  formatRbacManifestValidationError,
  isValidRbacName,
  RBAC_API_GROUP
} from './rbacValidation'

export interface ClusterRoleRef {
  apiGroup: 'rbac.authorization.k8s.io'
  kind: 'ClusterRole'
  name: string
}

export type ClusterRoleBindingSubject =
  | {
      kind: 'ServiceAccount'
      name: string
      namespace: string
      apiGroup?: ''
    }
  | {
      kind: 'User' | 'Group'
      name: string
      namespace?: string
      apiGroup?: 'rbac.authorization.k8s.io'
    }

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
  roleRef: ClusterRoleRef
  subjects: ClusterRoleBindingSubject[]
}

export interface ClusterRoleBindingConfig
  extends ClusterScopedNameFactoryConfigBase {
  roleRef: ClusterRoleRef
  subjects: ClusterRoleBindingSubject[]
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

const ServiceAccountSubjectSchema = z.object({
  kind: z.literal('ServiceAccount'),
  name: z.string().min(1),
  namespace: z.string().min(1),
  apiGroup: z.literal('').optional()
})

const UserSubjectSchema = z.object({
  kind: z.literal('User'),
  name: z.string().min(1),
  namespace: z.string().optional(),
  apiGroup: z
    .literal(RBAC_API_GROUP)
    .optional()
    .default(RBAC_API_GROUP)
})

const GroupSubjectSchema = z.object({
  kind: z.literal('Group'),
  name: z.string().min(1),
  namespace: z.string().optional(),
  apiGroup: z
    .literal(RBAC_API_GROUP)
    .optional()
    .default(RBAC_API_GROUP)
})

const SubjectSchema = z.discriminatedUnion('kind', [
  ServiceAccountSubjectSchema,
  UserSubjectSchema,
  GroupSubjectSchema
])

const RoleRefNameSchema = z.string().min(1).refine(isValidRbacName, {
  message: 'must be a valid RBAC path segment name'
})

const RoleRefSchema = z.object({
  apiGroup: z.literal(RBAC_API_GROUP).optional().default(RBAC_API_GROUP),
  kind: z.literal('ClusterRole'),
  name: RoleRefNameSchema
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
      formatRbacManifestValidationError(
        'ClusterRoleBinding',
        manifest,
        firstIssue
      )
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
