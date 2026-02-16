// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is an Operator?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does an Operator encode?',
      options: [
        'Only application code',
        'Operational knowledge and application lifecycle management',
        'Kubernetes API schemas',
        'Network policies'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Where does an Operator typically run?',
      options: [
        'On the host OS',
        'As a Pod in the cluster',
        'In etcd',
        'As a kubectl plugin'
      ],
      correctAnswer: 1
    }
  ]
}
