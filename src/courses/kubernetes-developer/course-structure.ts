import type { CourseStructure } from '../types'

// Parcours 2 — Développeur Kubernetes
// Workloads + Networking + Configuration (sans kubeconfig) pour les devs qui déploient sur K8s.
export const courseStructure: CourseStructure = {
  chapters: [
    // Workloads — déployer et gérer ses applications
    { moduleId: 'workloads', chapterId: 'pods-intro' },
    { moduleId: 'workloads', chapterId: 'pod-lifecycle' },
    { moduleId: 'workloads', chapterId: 'replicasets' },
    { moduleId: 'workloads', chapterId: 'deployments-intro' },
    { moduleId: 'workloads', chapterId: 'deployments-updates' },
    { moduleId: 'workloads', chapterId: 'statefulsets-intro' },
    { moduleId: 'workloads', chapterId: 'jobs-intro' },
    { moduleId: 'workloads', chapterId: 'cronjobs' },

    // Networking — exposer et connecter ses apps
    { moduleId: 'services-networking', chapterId: 'services-intro' },
    { moduleId: 'services-networking', chapterId: 'services-types' },
    { moduleId: 'services-networking', chapterId: 'dns-intro' },
    { moduleId: 'services-networking', chapterId: 'ingress-intro' },

    // Configuration — configurer ses apps correctement
    { moduleId: 'configuration', chapterId: 'configmaps-intro' },
    { moduleId: 'configuration', chapterId: 'secrets-intro' },
    { moduleId: 'configuration', chapterId: 'resource-management-intro' },
    { moduleId: 'configuration', chapterId: 'probes-intro' }
  ]
}
