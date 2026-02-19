import type { CourseStructure } from '../types'

// Parcours 4 — Platform Engineer (avancé)
// Progression orientee plateforme interne:
// standards d'equipe -> guardrails -> extension de l'API -> operabilite.
export const courseStructure: CourseStructure = {
  chapters: [
    // Standards et conventions plateforme
    { moduleId: 'overview', chapterId: 'object-management' },
    { moduleId: 'overview', chapterId: 'labels-intro' },

    // Guardrails multi-equipes
    { moduleId: 'policy', chapterId: 'resource-quotas' },
    { moduleId: 'security', chapterId: 'rbac-intro' },

    // Extension de Kubernetes
    { moduleId: 'extend-kubernetes', chapterId: 'custom-resources' },
    { moduleId: 'extend-kubernetes', chapterId: 'operators' },
    { moduleId: 'extend-kubernetes', chapterId: 'kubectl-plugins' },

    // Operabilite de la plateforme
    { moduleId: 'administration', chapterId: 'observability' },
    { moduleId: 'administration', chapterId: 'certificates' },
    { moduleId: 'configuration', chapterId: 'kubeconfig' }
  ]
}
