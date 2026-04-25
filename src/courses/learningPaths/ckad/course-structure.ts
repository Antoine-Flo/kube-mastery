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
        'organizing-resources'
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
        'deployments',
        'deployment-strategies'
      ]
    },
    {
      title: { en: 'Services & networking' },
      moduleIds: ['services', 'dns', 'gateway-api', 'network-policies']
    },
    {
      title: { en: 'Storage' },
      moduleIds: ['persistent-storage', 'statefulsets']
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
