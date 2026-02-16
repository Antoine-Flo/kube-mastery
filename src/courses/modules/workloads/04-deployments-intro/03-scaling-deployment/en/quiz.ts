// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Scaling a Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Scale the nginx-deployment to 5 replicas',
      options: [
        'kubectl scale deployment nginx-deployment --replicas=5',
        'kubectl scale nginx-deployment --replicas 5',
        'kubectl set replicas deployment nginx-deployment 5',
        'kubectl rollout scale deployment nginx-deployment 5'
      ],
      correctAnswer: 0
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
