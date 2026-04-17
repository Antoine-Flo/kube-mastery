import type { CourseStructure } from '../../../content/courses/types'

export const courseStructure: CourseStructure = {
  sections: [
    {
      title: { en: 'Fundamentals' },
      moduleIds: [
        'onboarding',
        'kubernetes-basics',
        'yaml-and-objects',
        'kubectl-essentials',
        'pods',
        'namespaces',
        'labels-and-annotations'
      ]
    },
    {
      title: { en: 'Cluster architecture & installation' },
      moduleIds: [
        'cluster-architecture-deep',
        'cluster-installation',
        'cluster-maintenance',
        'backup-and-restore'
      ]
    },
    {
      title: { en: 'Workloads & scheduling' },
      moduleIds: [
        'commands-and-args',
        'configmaps',
        'secrets',
        'resource-management',
        'replicasets',
        'deployments',
        'daemonsets',
        'multi-container-pods',
        'scheduling-basics',
        'advanced-scheduling',
        'probes',
        'jobs',
        'autoscaling',
        'statefulsets'
      ]
    },
    {
      title: { en: 'Services & networking' },
      moduleIds: [
        'services',
        'dns',
        'ingress',
        'gateway-api',
        'network-policies',
        'networking-fundamentals',
        'kubernetes-networking'
      ]
    },
    {
      title: { en: 'Storage' },
      moduleIds: ['volumes', 'persistent-storage', 'storage-classes']
    },
    {
      title: { en: 'Security & auth' },
      moduleIds: [
        'authentication',
        'service-accounts',
        'kubeconfig',
        'tls-certificates',
        'rbac',
        'security-contexts',
        'image-security',
        'admission-controllers',
        'pod-security'
      ]
    },
    {
      title: { en: 'Observability & troubleshooting' },
      moduleIds: ['logging-and-monitoring', 'troubleshooting']
    },
    {
      title: { en: 'API & extensibility' },
      moduleIds: ['api-and-versioning', 'custom-resources', 'helm']
    }
  ]
}
