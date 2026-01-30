import type { CourseStructure } from '../types';

export const courseStructure: CourseStructure = {
    chapters: [
        { moduleId: 'overview', chapterId: 'onboarding' },
        { moduleId: 'overview', chapterId: 'concepts-fondamentaux' },
        { moduleId: 'overview', chapterId: 'objets-kubernetes' },
        { moduleId: 'workloads', chapterId: 'pods-intro' },
        { moduleId: 'workloads', chapterId: 'deployments-intro' },
        { moduleId: 'services-networking', chapterId: 'services-intro' },
        { moduleId: 'services-networking', chapterId: 'services-types' },
    ],
};
