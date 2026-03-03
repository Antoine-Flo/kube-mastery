// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Controllers and Finalizers for Custom Resources
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What do finalizers prevent?',
      options: [
        'Creation of resources',
        'Deletion until the controller removes them after cleanup',
        'Updates to the resource',
        'RBAC checks'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What state does a resource enter when deleted but still has finalizers?',
      options: ['Deleted', 'Terminating', 'Pending', 'Failed'],
      correctAnswer: 1
    }
  ]
}
