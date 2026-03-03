// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - ResourceQuota Scopes
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Which scope applies to Pods with no CPU or memory requests/limits?',
      options: ['NotBestEffort', 'BestEffort', 'Terminating', 'NotTerminating'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is the purpose of ResourceQuota scopes?',
      options: [
        'To increase quota limits',
        'To filter which resources count toward the quota',
        'To apply quotas cluster-wide',
        'To delete old resources automatically'
      ],
      correctAnswer: 1
    }
  ]
}
