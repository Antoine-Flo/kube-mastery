// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Resource Requests and Limits
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does the scheduler use to decide which node can run a Pod?',
      options: [
        'Resource limits only',
        'Resource requests',
        'Resource limits and requests combined',
        'Node labels only'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does 250m mean for CPU?',
      options: [
        '250 CPU cores',
        '0.25 CPU cores (250 millicores)',
        '250 megabytes of CPU',
        '250 milliseconds of CPU time'
      ],
      correctAnswer: 1
    }
  ]
}
