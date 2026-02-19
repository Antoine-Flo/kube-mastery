import type { CourseStructure } from '../types'

// Parcours 2 — Développeur Kubernetes
// Progression orientée delivery applicatif:
// deploiements -> exposition -> config -> stateful/batch -> operations quotidiennes.
export const courseStructure: CourseStructure = {
  chapters: [
    // Workflow de delivery applicative
    { moduleId: 'overview', chapterId: 'object-management' },
    { moduleId: 'workloads', chapterId: 'replicasets' },
    { moduleId: 'workloads', chapterId: 'deployments-updates' },
    { moduleId: 'configuration', chapterId: 'secrets-intro' },
    { moduleId: 'services-networking', chapterId: 'ingress-intro' },
    { moduleId: 'configuration', chapterId: 'resource-management-intro' },

    // Applications stateful et persistance
    { moduleId: 'storage', chapterId: 'volumes-intro' },
    { moduleId: 'storage', chapterId: 'pv-pvc-intro' },
    { moduleId: 'workloads', chapterId: 'statefulsets-intro' },

    // Traitements batch et planification
    { moduleId: 'workloads', chapterId: 'jobs-intro' },
    { moduleId: 'workloads', chapterId: 'cronjobs' },

    // Hygiene des manifests et exploitation quotidienne
    { moduleId: 'overview', chapterId: 'labels-intro' },
    { moduleId: 'overview', chapterId: 'annotations' },
    { moduleId: 'overview', chapterId: 'operations' }
  ]
}
