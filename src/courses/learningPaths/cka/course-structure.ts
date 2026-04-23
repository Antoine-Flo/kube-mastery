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
        'kubeconfig',
        'pods',
        'organizing-resources'
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
      title: { en: 'Workloads' },
      moduleIds: [
        'deployments',
        'daemonsets',
        'jobs',
        'multi-container-pods',
        'probes',
        'statefulsets'
      ]
    },
    {
      title: { en: 'Configuration & scheduling' },
      moduleIds: [
        'configmaps',
        'secrets',
        'resource-management',
        'scheduling-basics',
        'advanced-scheduling',
        'autoscaling'
      ]
    },
    {
      title: { en: 'Services & networking' },
      moduleIds: [
        'networking-fundamentals',
        'kubernetes-networking',
        'services',
        'dns',
        'gateway-api',
        'network-policies'
      ]
    },
    {
      title: { en: 'Storage' },
      moduleIds: ['persistent-storage', 'storage-classes']
    },
    {
      title: { en: 'Security & auth' },
      moduleIds: [
        'authentication',
        'tls-certificates',
        'rbac',
        'security-contexts',
        'pod-and-image-security',
        'admission-controllers'
      ]
    },
    {
      title: { en: 'Observability & troubleshooting' },
      moduleIds: ['troubleshooting']
    },
    {
      title: { en: 'API & extensibility' },
      moduleIds: ['custom-resources', 'helm']
    }
  ]
}
