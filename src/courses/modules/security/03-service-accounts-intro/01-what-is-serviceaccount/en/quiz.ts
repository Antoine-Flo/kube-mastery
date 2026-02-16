// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a ServiceAccount?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a ServiceAccount provide to a Pod?',
      options: [
        'Resource limits',
        'An identity for API authentication',
        'Environment variables only',
        'A dedicated IP address'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which ServiceAccount does a Pod use if none is specified?',
      options: [
        'None',
        'The default ServiceAccount in its namespace',
        'A cluster-wide admin ServiceAccount',
        'The kube-system default'
      ],
      correctAnswer: 1
    }
  ]
}
