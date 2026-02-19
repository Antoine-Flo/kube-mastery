// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Declarative Object Configuration
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does kubectl apply do compared to replace?',
      options: [
        'Overwrites the entire object',
        'Patches only the differences, preserving Kubernetes-managed fields',
        'Always creates new objects',
        'Requires explicit create/update flags'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which command lets you preview changes before applying?',
      options: [
        'kubectl apply --dry-run',
        'kubectl diff',
        'kubectl plan',
        'kubectl preview'
      ],
      correctAnswer: 1
    }
  ]
}
