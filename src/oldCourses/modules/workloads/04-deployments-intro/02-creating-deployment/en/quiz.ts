// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the correct apiVersion for a Deployment object?',
      options: ['v1', 'apps/v1', 'v1beta1', 'batch/v1'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Create a Deployment from a YAML file named deployment.yaml',
      options: [
        'kubectl apply -f deployment.yaml',
        'kubectl create deployment.yaml',
        'kubectl run -f deployment.yaml',
        'kubectl deploy apply deployment.yaml'
      ],
      correctAnswer: 0
    }
  ]
}
