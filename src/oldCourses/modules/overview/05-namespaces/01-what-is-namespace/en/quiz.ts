// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a Namespace?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is a namespace in Kubernetes?',
      options: [
        'A physical partition of the cluster',
        'A mechanism for isolating groups of resources',
        'A networking concept',
        'A storage volume type'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which namespace is used for Kubernetes system components?',
      options: [
        'default',
        'kube-public',
        'kube-system',
        'kube-node-lease'
      ],
      correctAnswer: 2
    }
  ]
}
