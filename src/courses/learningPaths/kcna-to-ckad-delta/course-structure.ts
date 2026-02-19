import type { CourseStructure } from '../../../content/courses/types'

export const courseStructure: CourseStructure = {
  sections: [
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
        'deployment-strategies',
        'statefulsets'
      ]
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
      title: { en: 'API & extensibility' },
      moduleIds: ['api-and-versioning', 'custom-resources', 'helm']
    }
  ]
}
