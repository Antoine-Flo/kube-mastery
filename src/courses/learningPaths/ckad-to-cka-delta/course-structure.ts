import type { CourseStructure } from '../../../content/courses/types'

export const courseStructure: CourseStructure = {
  sections: [
    {
      title: { en: 'Cluster & networking' },
      moduleIds: [
        'cluster-architecture-deep',
        'networking-fundamentals',
        'kubernetes-networking',
        'cluster-installation',
        'cluster-maintenance',
        'backup-and-restore'
      ]
    },
    {
      title: { en: 'Scheduling & scaling' },
      moduleIds: ['daemonsets', 'scheduling-basics', 'advanced-scheduling', 'autoscaling']
    },
    {
      title: { en: 'Networking & storage' },
      moduleIds: ['gateway-api', 'storage-classes']
    },
    {
      title: { en: 'Security' },
      moduleIds: ['tls-certificates', 'image-security', 'pod-security']
    },
    {
      title: { en: 'Troubleshooting' },
      moduleIds: ['troubleshooting']
    }
  ]
}
