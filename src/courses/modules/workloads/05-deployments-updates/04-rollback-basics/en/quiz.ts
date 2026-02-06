// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Rollback Basics
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question: 'Rollback the nginx-deployment to the previous revision',
      expectedCommand: 'kubectl rollout undo deployment nginx-deployment',
      validationMode: 'contains',
      normalizeCommand: true
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'When is a new Deployment revision created?',
      options: [
        'When you scale the Deployment',
        'When the Pod template changes',
        'When you delete a Pod',
        'When you create a Service'
      ],
      correctAnswer: 1
    }
  ]
}
