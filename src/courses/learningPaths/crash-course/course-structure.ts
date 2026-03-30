import type { CourseStructure } from '../../../content/courses/types'

export const courseStructure: CourseStructure = {
  sections: [
    {
      title: { en: 'Foundations' },
      moduleIds: ['crash-course-foundations']
    },
    {
      title: { en: 'Workloads' },
      moduleIds: ['crash-course-workloads']
    },
    {
      title: { en: 'Networking' },
      moduleIds: ['crash-course-networking']
    },
    {
      title: { en: 'Storage' },
      moduleIds: ['crash-course-storage']
    }
  ]
}
