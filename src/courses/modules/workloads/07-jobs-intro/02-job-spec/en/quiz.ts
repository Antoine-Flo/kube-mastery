// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Job Specification
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does the parallelism field control?',
      options: [
        'Total number of completions needed',
        'Maximum number of Pods running simultaneously',
        'Number of retries on failure',
        'Job timeout in seconds'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does backoffLimit specify?',
      options: [
        'Number of successful completions',
        'Number of retries before marking Job failed',
        'Maximum parallelism',
        'Time between retries'
      ],
      correctAnswer: 1
    }
  ]
}
