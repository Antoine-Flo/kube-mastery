// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Viewing Resources
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What is the difference between kubectl get and kubectl describe?',
      options: [
        'They are identical',
        'get shows a summary, describe shows full details including events',
        'describe only works for Pods',
        'get requires a resource name'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Does kubectl get all list every resource type?',
      options: [
        'Yes',
        'No, it lists Pods, Services, Deployments, ReplicaSets, and a few others',
        'Only namespaced resources',
        'Only cluster-scoped resources'
      ],
      correctAnswer: 1
    }
  ]
}
