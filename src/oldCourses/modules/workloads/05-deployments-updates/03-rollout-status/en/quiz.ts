// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Rollout Status
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Check the rollout status of the nginx-deployment',
      options: [
        'kubectl rollout status deployment nginx-deployment',
        'kubectl get rollout nginx-deployment',
        'kubectl deployment status nginx-deployment',
        'kubectl describe rollout nginx-deployment'
      ],
      correctAnswer: 0
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What does the UP-TO-DATE field in kubectl get deployments show?',
      options: [
        'Total number of replicas',
        'Number of replicas updated to the desired state',
        'Number of failed replicas',
        'Age of the Deployment'
      ],
      correctAnswer: 1
    }
  ]
}
