import type { CourseStructure } from '../types'

// Parcours 3 — Opérateur / SRE Kubernetes
// Security + Storage + Policy + Administration + kubeconfig pour les ops/SREs.
export const courseStructure: CourseStructure = {
  chapters: [
    // Security — sécuriser le cluster
    { moduleId: 'security', chapterId: 'cloud-native-security' },
    { moduleId: 'security', chapterId: 'controlling-api-access' },
    { moduleId: 'security', chapterId: 'service-accounts-intro' },
    { moduleId: 'security', chapterId: 'rbac-intro' },
    { moduleId: 'security', chapterId: 'pod-security-standards' },
    { moduleId: 'security', chapterId: 'linux-security-intro' },

    // Storage — gérer le stockage persistant
    { moduleId: 'storage', chapterId: 'volumes-intro' },
    { moduleId: 'storage', chapterId: 'pv-pvc-intro' },
    { moduleId: 'storage', chapterId: 'storage-class-intro' },

    // Policy — gouvernance multi-tenant
    { moduleId: 'policy', chapterId: 'resource-quotas' },
    { moduleId: 'policy', chapterId: 'limit-ranges' },

    // Administration — opérer et surveiller
    { moduleId: 'administration', chapterId: 'logging' },
    { moduleId: 'administration', chapterId: 'observability' },
    { moduleId: 'administration', chapterId: 'certificates' },

    // Configuration (kubeconfig) — accès cluster multi-contexte
    { moduleId: 'configuration', chapterId: 'kubeconfig' }
  ]
}
