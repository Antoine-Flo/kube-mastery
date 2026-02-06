// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a ReplicaSet?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the main purpose of a ReplicaSet?',
      options: [
        'To schedule Pods to nodes',
        'To maintain a stable set of replica Pods running',
        'To provide load balancing',
        'To store configuration data'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is the recommended way to use ReplicaSets?',
      options: [
        'Directly create and manage ReplicaSets',
        'Use Deployments which manage ReplicaSets',
        'Use Services instead',
        'Use ConfigMaps'
      ],
      correctAnswer: 1
    }
  ]
}
