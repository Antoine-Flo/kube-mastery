// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - CronJob Specification
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does concurrencyPolicy: Forbid do?',
      options: [
        'Runs multiple Jobs in parallel',
        'Skips a new run if the previous Job is still running',
        'Replaces the old Job with a new one',
        'Prevents any Job from running'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does successfulJobsHistoryLimit control?',
      options: [
        'Max concurrent Jobs',
        'Number of succeeded Jobs to retain',
        'Schedule frequency',
        'Job timeout'
      ],
      correctAnswer: 1
    }
  ]
}
