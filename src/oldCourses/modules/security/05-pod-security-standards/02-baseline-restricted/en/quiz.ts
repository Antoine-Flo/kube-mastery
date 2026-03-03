// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Baseline and Restricted in Detail
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What must be dropped to meet the Restricted standard for capabilities?',
      options: [
        'Only NET_RAW',
        'Only dangerous capabilities',
        'ALL capabilities',
        'No capabilities need to be dropped'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does allowPrivilegeEscalation: false prevent?',
      options: [
        'The container from starting',
        'A process from gaining more privileges than its parent',
        'Root access entirely',
        'All capability drops'
      ],
      correctAnswer: 1
    }
  ]
}
