// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Working with Namespaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What happens when you delete a namespace?',
      options: [
        'Only the namespace metadata is removed',
        'All resources in that namespace are deleted',
        'Pods are moved to default namespace',
        'The operation fails if resources exist'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which flag lists resources across all namespaces?',
      options: [
        '-n all',
        '-A or --all-namespaces',
        '--global',
        '-w'
      ],
      correctAnswer: 1
    }
  ]
}
