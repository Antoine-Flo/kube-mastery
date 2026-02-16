import type { CourseStructure } from '../types'

// Kubernetes complete course - currently published chapters.
export const courseStructure: CourseStructure = {
  chapters: [
    // Part 1: Foundations
    { moduleId: 'overview', chapterId: 'onboarding' },
    { moduleId: 'overview', chapterId: 'concepts-fondamentaux' },
    { moduleId: 'overview', chapterId: 'objets-kubernetes' },
    { moduleId: 'overview', chapterId: 'object-management' },
    { moduleId: 'overview', chapterId: 'namespaces' },
    { moduleId: 'overview', chapterId: 'labels-intro' },
    { moduleId: 'overview', chapterId: 'annotations' },
    { moduleId: 'overview', chapterId: 'operations' },

    // Part 2: Workloads
    { moduleId: 'workloads', chapterId: 'pods-intro' },
    { moduleId: 'workloads', chapterId: 'pod-lifecycle' },
    { moduleId: 'workloads', chapterId: 'replicasets' },
    { moduleId: 'workloads', chapterId: 'deployments-intro' },
    { moduleId: 'workloads', chapterId: 'deployments-updates' },
    { moduleId: 'workloads', chapterId: 'statefulsets-intro' },
    { moduleId: 'workloads', chapterId: 'jobs-intro' },
    { moduleId: 'workloads', chapterId: 'cronjobs' },

    // Part 3: Networking
    { moduleId: 'services-networking', chapterId: 'services-intro' },
    { moduleId: 'services-networking', chapterId: 'services-types' },
    { moduleId: 'services-networking', chapterId: 'dns-intro' },
    { moduleId: 'services-networking', chapterId: 'ingress-intro' },

    // Part 4: Storage
    { moduleId: 'storage', chapterId: 'volumes-intro' },
    { moduleId: 'storage', chapterId: 'pv-pvc-intro' },
    { moduleId: 'storage', chapterId: 'storage-class-intro' },

    // Part 5: Configuration
    { moduleId: 'configuration', chapterId: 'configmaps-intro' },
    { moduleId: 'configuration', chapterId: 'secrets-intro' },
    { moduleId: 'configuration', chapterId: 'resource-management-intro' },
    { moduleId: 'configuration', chapterId: 'probes-intro' },
    { moduleId: 'configuration', chapterId: 'kubeconfig' },

    // Part 6: Security
    { moduleId: 'security', chapterId: 'cloud-native-security' },
    { moduleId: 'security', chapterId: 'controlling-api-access' },
    { moduleId: 'security', chapterId: 'service-accounts-intro' },
    { moduleId: 'security', chapterId: 'rbac-intro' },
    { moduleId: 'security', chapterId: 'pod-security-standards' },
    { moduleId: 'security', chapterId: 'linux-security-intro' },

    // Part 7: Policy and Administration
    { moduleId: 'policy', chapterId: 'resource-quotas' },
    { moduleId: 'policy', chapterId: 'limit-ranges' },
    { moduleId: 'administration', chapterId: 'logging' },
    { moduleId: 'administration', chapterId: 'observability' },
    { moduleId: 'administration', chapterId: 'certificates' },

    // Part 8: Extensions
    { moduleId: 'extend-kubernetes', chapterId: 'custom-resources' },
    { moduleId: 'extend-kubernetes', chapterId: 'operators' },
    { moduleId: 'extend-kubernetes', chapterId: 'kubectl-plugins' }
  ]
}
