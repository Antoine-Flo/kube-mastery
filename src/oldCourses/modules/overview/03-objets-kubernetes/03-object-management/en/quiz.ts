// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Object Management
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Which management technique automatically detects create, update, and delete operations?',
      options: [
        'Imperative commands',
        'Imperative object configuration',
        'Declarative object configuration',
        'All of the above'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Create a deployment named nginx using the imperative command approach',
      options: [
        'kubectl create deployment nginx --image nginx',
        'kubectl run deployment nginx --image nginx',
        'kubectl apply deployment nginx --image nginx',
        'kubectl new deployment nginx --image nginx'
      ],
      correctAnswer: 0
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question:
        'What is the recommended approach for managing Kubernetes objects in production?',
      options: [
        'Only imperative commands',
        'Only declarative object configuration',
        'Mix imperative and declarative approaches',
        'Use only one technique per object'
      ],
      correctAnswer: 3
    }
  ]
}
