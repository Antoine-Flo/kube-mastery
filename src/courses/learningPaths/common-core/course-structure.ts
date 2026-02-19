import type { CourseStructure } from '../../../content/courses/types'

export const courseStructure: CourseStructure = {
  sections: [
    {
      title: { en: 'Fundamentals' },
      moduleIds: [
        'onboarding',
        'kubernetes-basics',
        'yaml-and-objects',
        'pods',
        'kubectl-essentials',
        'namespaces',
        'labels-and-annotations'
      ]
    },
    {
      title: { en: 'Workloads' },
      moduleIds: ['replicasets', 'deployments']
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
      title: { en: 'Observability' },
      moduleIds: ['logging-and-monitoring']
    }
  ]
}
