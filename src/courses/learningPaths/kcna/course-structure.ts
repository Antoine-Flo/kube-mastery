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
        'namespaces',
        'labels-and-annotations'
      ]
    },
    {
      title: { en: 'Workloads & scheduling' },
      moduleIds: ['replicasets', 'deployments', 'scheduling-basics']
    },
    {
      title: { en: 'Services & networking' },
      moduleIds: ['services', 'dns', 'ingress', 'network-policies']
    },
    {
      title: { en: 'Storage' },
      moduleIds: ['volumes', 'persistent-storage']
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
