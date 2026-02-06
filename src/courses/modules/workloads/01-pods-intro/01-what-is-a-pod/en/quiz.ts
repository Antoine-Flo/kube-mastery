// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a Pod?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the smallest deployable unit in Kubernetes?',
      options: ['Container', 'Pod', 'Node', 'Service'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is the most common Pod model in Kubernetes?',
      options: [
        'Multiple containers per Pod',
        'One container per Pod',
        'No containers in Pods',
        'Pods without containers'
      ],
      correctAnswer: 1
    }
  ]
}
