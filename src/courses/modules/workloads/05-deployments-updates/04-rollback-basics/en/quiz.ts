// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Rollback Basics
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Rollback the nginx-deployment to the previous revision',
      options: [
        'kubectl rollout undo deployment nginx-deployment',
        'kubectl rollback deployment nginx-deployment',
        'kubectl undo deployment nginx-deployment',
        'kubectl rollout previous deployment nginx-deployment'
      ],
      correctAnswer: 0
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
