import { describe, expect, it } from 'vitest'
import {
  createClusterRoleBinding,
  parseClusterRoleBindingManifest
} from '../../../../src/core/cluster/ressources/ClusterRoleBinding'

describe('ClusterRoleBinding', () => {
  describe('createClusterRoleBinding', () => {
    it('should create ClusterRoleBinding with required fields', () => {
      const clusterRoleBinding = createClusterRoleBinding({
        name: 'readers-binding',
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: 'view'
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: 'reader',
            namespace: 'default'
          }
        ]
      })

      expect(clusterRoleBinding.apiVersion).toBe('rbac.authorization.k8s.io/v1')
      expect(clusterRoleBinding.kind).toBe('ClusterRoleBinding')
      expect(clusterRoleBinding.metadata.name).toBe('readers-binding')
      expect(clusterRoleBinding.roleRef.kind).toBe('ClusterRole')
      expect(clusterRoleBinding.subjects).toHaveLength(1)
    })
  })

  describe('parseClusterRoleBindingManifest', () => {
    it('should parse valid manifest with ClusterRole roleRef', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: {
          name: 'readers-binding'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: 'view'
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: 'reader',
            namespace: 'default'
          }
        ]
      }

      const result = parseClusterRoleBindingManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.roleRef.kind).toBe('ClusterRole')
      }
    })

    it('should default roleRef.apiGroup when omitted', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: {
          name: 'defaulted-role-ref-apigroup'
        },
        roleRef: {
          kind: 'ClusterRole',
          name: 'view'
        },
        subjects: []
      }

      const result = parseClusterRoleBindingManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.roleRef.apiGroup).toBe('rbac.authorization.k8s.io')
      }
    })

    it('should reject manifest when roleRef.kind is Role', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: {
          name: 'invalid-binding'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'Role',
          name: 'namespace-reader'
        },
        subjects: []
      }

      const result = parseClusterRoleBindingManifest(manifest)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid ClusterRoleBinding manifest')
        expect(result.error).toContain('roleRef.kind')
      }
    })

    it('should reject serviceaccount subject without namespace', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: {
          name: 'invalid-subject'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: 'view'
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: 'reader'
          }
        ]
      }

      const result = parseClusterRoleBindingManifest(manifest)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Invalid ClusterRoleBinding manifest')
        expect(result.error).toContain('subjects')
      }
    })

    it('should accept serviceaccount subject with empty apiGroup', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: {
          name: 'sa-empty-apigroup'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: 'view'
        },
        subjects: [
          {
            kind: 'ServiceAccount',
            name: 'reader',
            namespace: 'default',
            apiGroup: ''
          }
        ]
      }

      const result = parseClusterRoleBindingManifest(manifest)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.subjects[0]).toMatchObject({
          kind: 'ServiceAccount',
          name: 'reader',
          namespace: 'default',
          apiGroup: ''
        })
      }
    })

    it('should reject roleRef name that is not a valid RBAC path segment', () => {
      const manifest = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'ClusterRoleBinding',
        metadata: {
          name: 'invalid-role-ref-name'
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          name: 'bad/name'
        },
        subjects: []
      }

      const result = parseClusterRoleBindingManifest(manifest)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('roleRef.name')
      }
    })
  })
})
