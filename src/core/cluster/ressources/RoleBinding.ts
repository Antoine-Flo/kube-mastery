import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'
import {
  formatRbacManifestValidationError,
  isValidRbacName,
  RBAC_API_GROUP
} from './rbacValidation'

export interface RoleRef {
  apiGroup: 'rbac.authorization.k8s.io'
  kind: 'Role' | 'ClusterRole'
  name: string
}

export interface Subject {
  kind: 'ServiceAccount' | 'User' | 'Group'
  name: string
  namespace?: string
  apiGroup?: '' | 'rbac.authorization.k8s.io'
}

export interface RoleBinding {
  apiVersion: 'rbac.authorization.k8s.io/v1'
  kind: 'RoleBinding'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp: string
  }
  roleRef: RoleRef
  subjects: Subject[]
}

export interface RoleBindingConfig extends NamespacedFactoryConfigBase {
  roleRef: RoleRef
  subjects: Subject[]
}

export const createRoleBinding = (config: RoleBindingConfig): RoleBinding => {
  const roleBinding: RoleBinding = {
    apiVersion: 'rbac.authorization.k8s.io/v1',
    kind: 'RoleBinding',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    roleRef: config.roleRef,
    subjects: config.subjects
  }
  return deepFreeze(roleBinding)
}

const ServiceAccountSubjectSchema = z.object({
  kind: z.literal('ServiceAccount'),
  name: z.string().min(1),
  namespace: z.string().optional(),
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
  kind: z.enum(['Role', 'ClusterRole']),
  name: RoleRefNameSchema
})

const RoleBindingManifestSchema = z.object({
  apiVersion: z.literal('rbac.authorization.k8s.io/v1'),
  kind: z.literal('RoleBinding'),
  metadata: z.object({
    name: z.string().min(1),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  roleRef: RoleRefSchema,
  subjects: z.array(SubjectSchema).default([])
})

export const parseRoleBindingManifest = (
  manifest: unknown
): Result<RoleBinding> => {
  const parsed = RoleBindingManifestSchema.safeParse(manifest)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return error(formatRbacManifestValidationError('RoleBinding', manifest, firstIssue))
  }
  return success(
    createRoleBinding({
      name: parsed.data.metadata.name,
      namespace: parsed.data.metadata.namespace,
      labels: parsed.data.metadata.labels,
      annotations: parsed.data.metadata.annotations,
      creationTimestamp: parsed.data.metadata.creationTimestamp,
      roleRef: parsed.data.roleRef,
      subjects: parsed.data.subjects
    })
  )
}
