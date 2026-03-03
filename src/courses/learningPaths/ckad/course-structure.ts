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
      title: { en: 'Workloads & configuration' },
      moduleIds: [
        'commands-and-args',
        'multi-container-pods',
        'jobs',
        'configmaps',
        'secrets',
        'resource-management',
        'probes',
        'security-contexts',
        'replicasets',
        'deployments',
        'deployment-strategies'
      ]
    },
    {
      title: { en: 'Services & networking' },
      moduleIds: ['services', 'dns', 'ingress', 'network-policies']
    },
    {
      title: { en: 'Storage' },
      moduleIds: ['volumes', 'persistent-storage', 'statefulsets']
    },
    {
      title: { en: 'Security & auth' },
      moduleIds: [
        'service-accounts',
        'authentication',
        'kubeconfig',
        'rbac',
        'admission-controllers'
      ]
    },
    {
      title: { en: 'Observability & extensibility' },
      moduleIds: [
        'logging-and-monitoring',
        'api-and-versioning',
        'custom-resources',
        'helm'
      ]
    }
  ]
}
