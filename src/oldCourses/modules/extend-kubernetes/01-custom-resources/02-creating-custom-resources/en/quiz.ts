// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating Custom Resources
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Do CRDs alone execute business logic when you create a custom resource?',
      options: [
        'Yes, they run controllers automatically',
        'No, they only store data; a controller must implement logic',
        'Yes, via the API server',
        'Only for built-in types'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'How do you list custom resources for cronjobs.stable.example.com?',
      options: [
        'kubectl get cronjob',
        'kubectl get cronjobs.stable.example.com',
        'kubectl get crd cronjob',
        'kubectl list cronjobs'
      ],
      correctAnswer: 1
    }
  ]
}
