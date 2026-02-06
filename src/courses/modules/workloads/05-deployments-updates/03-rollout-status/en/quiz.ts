// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Rollout Status
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question: 'Check the rollout status of the nginx-deployment',
      expectedCommand: 'kubectl rollout status deployment nginx-deployment',
      validationMode: 'contains',
      normalizeCommand: true
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does the UP-TO-DATE field in kubectl get deployments show?',
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
