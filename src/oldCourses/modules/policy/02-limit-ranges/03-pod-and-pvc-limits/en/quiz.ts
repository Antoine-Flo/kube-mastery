// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Pod and PVC Limit Ranges
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'For type: Pod in a LimitRange, what do min/max constrain?',
      options: [
        'Number of Pods in the namespace',
        'Sum of all container resources in the Pod',
        'Number of containers per Pod',
        'Pod restart count'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does a PersistentVolumeClaim LimitRange constrain?',
      options: [
        'Number of PVCs',
        'Storage size that can be requested',
        'Access modes',
        'StorageClass name'
      ],
      correctAnswer: 1
    }
  ]
}
