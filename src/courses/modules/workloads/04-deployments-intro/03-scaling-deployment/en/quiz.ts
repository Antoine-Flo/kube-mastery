// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Scaling a Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question: 'Scale the nginx-deployment to 5 replicas',
      expectedCommand: 'kubectl scale deployment nginx-deployment --replicas=5',
      validationMode: 'contains',
      normalizeCommand: true
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What component actually creates or deletes Pods when scaling a Deployment?',
      options: [
        'The Deployment controller directly',
        'The ReplicaSet controller',
        'The kubelet',
        'The scheduler'
      ],
      correctAnswer: 1
    }
  ]
}
