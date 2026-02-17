import type { CourseStructure } from '../types'

// Parcours 1 — Fondamentaux Kubernetes (tronc commun)
// Répartition équilibrée entre concepts, workloads, réseau et configuration.
export const courseStructure: CourseStructure = {
  chapters: [
    // Concepts de base
    { moduleId: 'overview', chapterId: 'onboarding' },
    { moduleId: 'overview', chapterId: 'concepts-fondamentaux' },
    { moduleId: 'overview', chapterId: 'objets-kubernetes' },
    { moduleId: 'overview', chapterId: 'namespaces' },

    // Premiers workloads
    { moduleId: 'workloads', chapterId: 'pods-intro' },
    { moduleId: 'workloads', chapterId: 'pod-lifecycle' },
    { moduleId: 'workloads', chapterId: 'deployments-intro' },

    // Premiers services et réseau
    { moduleId: 'services-networking', chapterId: 'services-intro' },
    { moduleId: 'services-networking', chapterId: 'services-types' },
    { moduleId: 'services-networking', chapterId: 'dns-intro' },

    // Première configuration applicative
    { moduleId: 'configuration', chapterId: 'configmaps-intro' },
    { moduleId: 'configuration', chapterId: 'probes-intro' }
  ]
}
