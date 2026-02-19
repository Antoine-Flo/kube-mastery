import type { CourseStructure } from '../types'

// Parcours 3 — Opérateur / SRE Kubernetes
// Progression orientee operations production:
// acces cluster -> securite -> gouvernance -> stockage -> exploitation.
export const courseStructure: CourseStructure = {
  chapters: [
    // Configuration d'acces au cluster
    { moduleId: 'configuration', chapterId: 'kubeconfig' },

    // Security — sécuriser le cluster
    { moduleId: 'security', chapterId: 'cloud-native-security' },
    { moduleId: 'security', chapterId: 'controlling-api-access' },
    { moduleId: 'security', chapterId: 'service-accounts-intro' },
    { moduleId: 'security', chapterId: 'rbac-intro' },
    { moduleId: 'security', chapterId: 'pod-security-standards' },
    { moduleId: 'security', chapterId: 'linux-security-intro' },

    // Policy — gouvernance multi-tenant
    { moduleId: 'policy', chapterId: 'resource-quotas' },
    { moduleId: 'policy', chapterId: 'limit-ranges' },

    // Storage — capacite et provisioning
    { moduleId: 'storage', chapterId: 'storage-class-intro' },

    // Administration — opérer et surveiller
    { moduleId: 'administration', chapterId: 'logging' },
    { moduleId: 'administration', chapterId: 'observability' },
    { moduleId: 'administration', chapterId: 'certificates' }
  ]
}
