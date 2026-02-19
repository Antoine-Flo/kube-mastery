// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Pod Security Standards - Three Levels
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which Pod Security Standard level has the fewest restrictions?',
      options: [
        'Restricted',
        'Baseline',
        'Privileged',
        'Standard'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which level requires runAsNonRoot?',
      options: [
        'Privileged',
        'Baseline',
        'Restricted',
        'All levels'
      ],
      correctAnswer: 2
    }
  ]
}
