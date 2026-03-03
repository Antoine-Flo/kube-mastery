// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Label Selectors
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How does a Service find Pods to route traffic to?',
      options: [
        'By namespace only',
        'By label selector matching Pod labels',
        'By Pod name',
        'By creation time'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which is a valid set-based selector operator?',
      options: ['Equals', 'In', 'SameAs', 'Contains'],
      correctAnswer: 1
    }
  ]
}
