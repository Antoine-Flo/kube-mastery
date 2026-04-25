import type { CourseStructure } from '../../../content/courses/types'

export const courseStructure: CourseStructure = {
  sections: [
    {
      title: { en: 'Fundamentals' },
      moduleIds: [
        'onboarding',
        'containers-fundamentals',
        'kubernetes-basics',
        'yaml-and-objects',
        'kubectl-essentials',
        'pods',
        'organizing-resources'
      ]
    },
    {
      title: { en: 'Workloads & scheduling' },
      moduleIds: ['deployments', 'scheduling-basics']
    },
    {
      title: { en: 'Services & networking' },
      moduleIds: ['services', 'dns', 'gateway-api', 'network-policies']
    },
    {
      title: { en: 'Storage' },
      moduleIds: ['persistent-storage']
    },
    {
      title: { en: 'Cloud native & ecosystem' },
      moduleIds: [
        'cloud-native-ecosystem',
        'autoscaling',
        'logging-and-monitoring',
        'observability-concepts',
        'gitops',
        'service-mesh'
      ]
    }
  ]
}
