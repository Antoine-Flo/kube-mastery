// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Updating a Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Update the nginx container image in nginx-deployment to nginx:1.16.1',
      options: [
        'kubectl set image deployment nginx-deployment nginx=nginx:1.16.1',
        'kubectl update deployment nginx-deployment --image nginx:1.16.1',
        'kubectl edit deployment nginx-deployment --image nginx:1.16.1',
        'kubectl apply image nginx-deployment nginx:1.16.1'
      ],
      correctAnswer: 0
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
