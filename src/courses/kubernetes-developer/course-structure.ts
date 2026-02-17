import type { CourseStructure } from '../types'

// Parcours 2 — Développeur Kubernetes
// Suite logique des fondamentaux, sans doublons avec le parcours 1.
export const courseStructure: CourseStructure = {
  chapters: [
    // Overview (suite) — manipuler les objets proprement
    { moduleId: 'overview', chapterId: 'object-management' },
    { moduleId: 'overview', chapterId: 'labels-intro' },
    { moduleId: 'overview', chapterId: 'annotations' },
    { moduleId: 'overview', chapterId: 'operations' },

    // Workloads (suite) — déploiements applicatifs avancés
    { moduleId: 'workloads', chapterId: 'replicasets' },
    { moduleId: 'workloads', chapterId: 'deployments-updates' },
    { moduleId: 'workloads', chapterId: 'statefulsets-intro' },
    { moduleId: 'workloads', chapterId: 'jobs-intro' },
    { moduleId: 'workloads', chapterId: 'cronjobs' },

    // Networking (suite) — entrée HTTP
    { moduleId: 'services-networking', chapterId: 'ingress-intro' },

    // Configuration (suite) — secret management et ressources
    { moduleId: 'configuration', chapterId: 'secrets-intro' },
    { moduleId: 'configuration', chapterId: 'resource-management-intro' }
  ]
}
