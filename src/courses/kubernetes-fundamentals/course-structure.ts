import type { CourseStructure } from '../types'

// Parcours 1 — Fondamentaux Kubernetes (tronc commun)
// Couvre le module overview complet + premiers pas avec Pods, Deployments et Services.
export const courseStructure: CourseStructure = {
  chapters: [
    // Concepts et organisation
    { moduleId: 'overview', chapterId: 'onboarding' },
    { moduleId: 'overview', chapterId: 'concepts-fondamentaux' },
    { moduleId: 'overview', chapterId: 'objets-kubernetes' },
    { moduleId: 'overview', chapterId: 'object-management' },
    { moduleId: 'overview', chapterId: 'namespaces' },
    { moduleId: 'overview', chapterId: 'labels-intro' },
    { moduleId: 'overview', chapterId: 'annotations' },
    { moduleId: 'overview', chapterId: 'operations' },

    // Premiers workloads
    { moduleId: 'workloads', chapterId: 'pods-intro' },
    { moduleId: 'workloads', chapterId: 'deployments-intro' },

    // Premiers services
    { moduleId: 'services-networking', chapterId: 'services-intro' },
    { moduleId: 'services-networking', chapterId: 'services-types' }
  ]
}
