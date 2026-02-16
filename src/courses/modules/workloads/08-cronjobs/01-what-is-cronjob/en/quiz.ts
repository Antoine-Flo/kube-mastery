// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a CronJob?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a CronJob create?',
      options: [
        'Deployments',
        'Jobs on a schedule',
        'StatefulSets',
        'Services'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does the schedule "0 * * * *" mean?',
      options: [
        'Every minute',
        'At minute 0 of every hour (hourly)',
        'Once per day at midnight',
        'Every 5 minutes'
      ],
      correctAnswer: 1
    }
  ]
}
