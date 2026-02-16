import type { CourseStructure } from '../types'

// Parcours 4 — Platform Engineer (avancé)
// Étendre Kubernetes : CRDs, Operators, kubectl plugins.
// Sera enrichi avec Helm et Istio ultérieurement.
export const courseStructure: CourseStructure = {
  chapters: [
    { moduleId: 'extend-kubernetes', chapterId: 'custom-resources' },
    { moduleId: 'extend-kubernetes', chapterId: 'operators' },
    { moduleId: 'extend-kubernetes', chapterId: 'kubectl-plugins' }
  ]
}
