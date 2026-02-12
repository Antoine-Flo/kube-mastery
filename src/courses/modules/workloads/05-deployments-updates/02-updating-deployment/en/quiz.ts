// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Updating a Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question:
        'Update the nginx container image in nginx-deployment to nginx:1.16.1',
      expectedCommand:
        'kubectl set image deployment nginx-deployment nginx=nginx:1.16.1',
      validationMode: 'contains',
      normalizeCommand: true
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What change triggers a Deployment rollout?',
      options: [
        'Changing the number of replicas',
        'Changing the Pod template',
        'Adding a label',
        'Changing the namespace'
      ],
      correctAnswer: 1
    }
  ]
}
