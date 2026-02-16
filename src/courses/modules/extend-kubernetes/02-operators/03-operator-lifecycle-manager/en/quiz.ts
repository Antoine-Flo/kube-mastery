// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Operator Lifecycle Manager
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does OLM provide?',
      options: [
        'Pod scheduling only',
        'Install, upgrade, and lifecycle management of Operators',
        'Certificate rotation',
        'Network policies'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What resource do you create to request an Operator from a catalog?',
      options: [
        'Deployment',
        'Subscription',
        'ConfigMap',
        'Secret'
      ],
      correctAnswer: 1
    }
  ]
}
