import { describe, expect, it } from 'vitest'
import { parseRoleBindingManifest } from '../../../../src/core/cluster/ressources/RoleBinding'

describe('RoleBinding', () => {
  describe('parseRoleBindingManifest', () => {
    it('should default roleRef.apiGroup when omitted', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: {
          name: 'reader-binding',
          namespace: 'default'
        },
        roleRef: {
          kind: 'Role',
          name: 'reader'
        },
        subjects: []
      }

      const result = parseRoleBindingManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.roleRef.apiGroup).toBe('rbac.authorization.k8s.io')
      }
    })

    it('should accept serviceaccount subject with empty apiGroup', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: {
          name: 'sa-subject-binding',
          namespace: 'default'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: 'reader'
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: 'app-sa',
            namespace: 'default',
            apiGroup: ''
          }
        ]
      }

      const result = parseRoleBindingManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.subjects[0]).toMatchObject({
          kind: 'ServiceAccount',
          name: 'app-sa',
          namespace: 'default',
          apiGroup: ''
        })
      }
    })

    it('should default apiGroup for User and Group subjects', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: {
          name: 'user-group-subjects',
          namespace: 'default'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: 'view'
        },
        subjects: [
          {
            kind: 'User',
            name: 'alice'
          },
          {
            kind: 'Group',
            name: 'devs'
          }
        ]
      }

      const result = parseRoleBindingManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.subjects[0]).toMatchObject({
          kind: 'User',
          name: 'alice',
          apiGroup: 'rbac.authorization.k8s.io'
        })
        expect(result.value.subjects[1]).toMatchObject({
          kind: 'Group',
          name: 'devs',
          apiGroup: 'rbac.authorization.k8s.io'
        })
      }
    })

    it('should reject roleRef name that is not a valid RBAC path segment', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: {
          name: 'invalid-role-ref-name',
          namespace: 'default'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: 'bad/name'
        },
        subjects: []
      }

      const result = parseRoleBindingManifest(manifest)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('roleRef.name')
      }
    })
  })
})
