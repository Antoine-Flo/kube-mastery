import type { CourseStructure } from '../types'

// Cours complet Kubernetes - 95 chapitres organisés en 11 parties
export const courseStructure: CourseStructure = {
  chapters: [
    // Partie 1 : Fondations et Architecture (10 chapitres)
    { moduleId: 'overview', chapterId: 'onboarding' },
    { moduleId: 'overview', chapterId: 'concepts-fondamentaux' },
    { moduleId: 'overview', chapterId: 'evolution-deployment' },
    { moduleId: 'overview', chapterId: 'objets-kubernetes' },
    { moduleId: 'overview', chapterId: 'object-management' },
    { moduleId: 'overview', chapterId: 'namespaces' },
    { moduleId: 'overview', chapterId: 'labels-intro' },
    { moduleId: 'overview', chapterId: 'annotations' },
    { moduleId: 'overview', chapterId: 'common-labels' },
    { moduleId: 'overview', chapterId: 'operations' },

    // Partie 2 : Architecture Interne (6 chapitres)
    { moduleId: 'architecture', chapterId: 'components-intro' },
    { moduleId: 'architecture', chapterId: 'nodes' },
    { moduleId: 'architecture', chapterId: 'control-plane-components' },
    { moduleId: 'overview', chapterId: 'api-intro' },
    { moduleId: 'overview', chapterId: 'api-versioning' },
    { moduleId: 'architecture', chapterId: 'controllers-pattern' },

    // Partie 3 : Containers et Pods (10 chapitres)
    { moduleId: 'containers', chapterId: 'images-container' },
    { moduleId: 'containers', chapterId: 'container-environment' },
    { moduleId: 'workloads', chapterId: 'pods-intro' },
    { moduleId: 'workloads', chapterId: 'pod-lifecycle' },
    { moduleId: 'workloads', chapterId: 'pods-multi-containers' },
    { moduleId: 'workloads', chapterId: 'init-containers' },
    { moduleId: 'workloads', chapterId: 'sidecar-containers' },
    { moduleId: 'workloads', chapterId: 'ephemeral-containers' },
    { moduleId: 'containers', chapterId: 'lifecycle-hooks' },
    { moduleId: 'workloads', chapterId: 'pod-qos' },

    // Partie 4 : Controllers de Workloads (12 chapitres)
    { moduleId: 'workloads', chapterId: 'replicasets' },
    { moduleId: 'workloads', chapterId: 'deployments-intro' },
    { moduleId: 'workloads', chapterId: 'deployments-updates' },
    { moduleId: 'workloads', chapterId: 'deployments-avance' },
    { moduleId: 'workloads', chapterId: 'statefulsets-intro' },
    { moduleId: 'workloads', chapterId: 'statefulsets-avance' },
    { moduleId: 'workloads', chapterId: 'daemonsets' },
    { moduleId: 'workloads', chapterId: 'jobs-intro' },
    { moduleId: 'workloads', chapterId: 'jobs-avance' },
    { moduleId: 'workloads', chapterId: 'cronjobs' },
    { moduleId: 'workloads', chapterId: 'pod-disruptions' },
    { moduleId: 'workloads', chapterId: 'downward-api' },

    // Partie 5 : Autoscaling (3 chapitres)
    { moduleId: 'workloads', chapterId: 'hpa-intro' },
    { moduleId: 'workloads', chapterId: 'hpa-avance' },
    { moduleId: 'workloads', chapterId: 'vpa' },

    // Partie 6 : Networking et Services (12 chapitres)
    { moduleId: 'services-networking', chapterId: 'services-intro' },
    { moduleId: 'services-networking', chapterId: 'services-types' },
    { moduleId: 'services-networking', chapterId: 'services-avance' },
    { moduleId: 'services-networking', chapterId: 'endpoints' },
    { moduleId: 'services-networking', chapterId: 'dns-intro' },
    { moduleId: 'services-networking', chapterId: 'dns-avance' },
    { moduleId: 'services-networking', chapterId: 'ingress-intro' },
    { moduleId: 'services-networking', chapterId: 'ingress-avance' },
    { moduleId: 'services-networking', chapterId: 'ingress-controllers' },
    { moduleId: 'services-networking', chapterId: 'gateway-api' },
    { moduleId: 'services-networking', chapterId: 'network-policies-intro' },
    { moduleId: 'services-networking', chapterId: 'network-policies-avance' },

    // Partie 7 : Storage (10 chapitres)
    { moduleId: 'storage', chapterId: 'volumes-intro' },
    { moduleId: 'storage', chapterId: 'volumes-types' },
    { moduleId: 'storage', chapterId: 'pv-pvc-intro' },
    { moduleId: 'storage', chapterId: 'pv-pvc-avance' },
    { moduleId: 'storage', chapterId: 'storage-class-intro' },
    { moduleId: 'storage', chapterId: 'storage-class-avance' },
    { moduleId: 'storage', chapterId: 'ephemeral-volumes' },
    { moduleId: 'storage', chapterId: 'projected-volumes' },
    { moduleId: 'storage', chapterId: 'volume-snapshots' },
    { moduleId: 'storage', chapterId: 'csi' },

    // Partie 8 : Configuration (8 chapitres)
    { moduleId: 'configuration', chapterId: 'configmaps-intro' },
    { moduleId: 'configuration', chapterId: 'configmaps-avance' },
    { moduleId: 'configuration', chapterId: 'secrets-intro' },
    { moduleId: 'configuration', chapterId: 'secrets-avance' },
    { moduleId: 'configuration', chapterId: 'resource-management-intro' },
    { moduleId: 'configuration', chapterId: 'resource-management-avance' },
    { moduleId: 'configuration', chapterId: 'probes-intro' },
    { moduleId: 'configuration', chapterId: 'probes-avance' },

    // Partie 9 : Sécurité (10 chapitres)
    { moduleId: 'security', chapterId: 'cloud-native-security' },
    { moduleId: 'security', chapterId: 'controlling-api-access' },
    { moduleId: 'security', chapterId: 'service-accounts-intro' },
    { moduleId: 'security', chapterId: 'service-accounts-avance' },
    { moduleId: 'security', chapterId: 'rbac-intro' },
    { moduleId: 'security', chapterId: 'rbac-avance' },
    { moduleId: 'security', chapterId: 'pod-security-standards' },
    { moduleId: 'security', chapterId: 'pod-security-admission' },
    { moduleId: 'security', chapterId: 'linux-security-intro' },
    { moduleId: 'security', chapterId: 'linux-security-avance' },

    // Partie 10 : Policies et Administration (8 chapitres)
    { moduleId: 'policy', chapterId: 'resource-quotas' },
    { moduleId: 'policy', chapterId: 'limit-ranges' },
    { moduleId: 'administration', chapterId: 'logging' },
    { moduleId: 'administration', chapterId: 'observability' },
    { moduleId: 'administration', chapterId: 'node-autoscaling' },
    { moduleId: 'administration', chapterId: 'certificates' },
    { moduleId: 'administration', chapterId: 'admission-webhooks' },
    { moduleId: 'administration', chapterId: 'flow-control' },

    // Partie 11 : Avancé - Extensions (6 chapitres)
    { moduleId: 'extend-kubernetes', chapterId: 'custom-resources' },
    { moduleId: 'extend-kubernetes', chapterId: 'admission-webhooks-dev' },
    { moduleId: 'extend-kubernetes', chapterId: 'operators' },
    { moduleId: 'extend-kubernetes', chapterId: 'api-aggregation' },
    { moduleId: 'extend-kubernetes', chapterId: 'kubectl-plugins' },
    { moduleId: 'overview', chapterId: 'labels-avance' }
  ]
}
