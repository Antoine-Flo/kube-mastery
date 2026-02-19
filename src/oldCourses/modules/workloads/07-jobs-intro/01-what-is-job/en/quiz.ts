// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a Job?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is a Job used for?',
      options: [
        'Long-running stateless applications',
        'Finite workloads that run to completion',
        'Stateful applications with stable identity',
        'Scheduled recurring tasks'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What must the restartPolicy be for a Job Pod template?',
      options: [
        'Always',
        'Never or OnFailure',
        'RestartOnFailure only',
        'Any value is allowed'
      ],
      correctAnswer: 1
    }
  ]
}
