// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Suspend and Time Zone
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does suspend: true do to a CronJob?',
      options: [
        'Deletes all existing Jobs',
        'Prevents new Jobs from being created',
        'Pauses running Jobs',
        'Deletes the CronJob'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Without timeZone, how is the schedule interpreted?',
      options: [
        'In the Pod\'s time zone',
        'In the kube-controller-manager\'s local time (often UTC)',
        'In the client\'s time zone',
        'As relative to cluster creation time'
      ],
      correctAnswer: 1
    }
  ]
}
