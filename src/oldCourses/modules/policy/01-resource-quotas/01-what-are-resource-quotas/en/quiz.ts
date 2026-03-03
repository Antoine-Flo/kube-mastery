// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What are Resource Quotas?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'At which scope do ResourceQuotas apply?',
      options: ['Cluster-wide', 'Per namespace', 'Per Pod', 'Per node'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What happens when creating a resource would exceed the namespace quota?',
      options: [
        'The resource is created but marked as low priority',
        'Creation is rejected',
        'Existing resources are evicted',
        'The quota is automatically increased'
      ],
      correctAnswer: 1
    }
  ]
}
