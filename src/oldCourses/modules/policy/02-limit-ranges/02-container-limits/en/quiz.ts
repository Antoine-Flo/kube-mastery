// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Container Limit Ranges
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What happens when a Pod specifies a container with memory limit above the LimitRange max?',
      options: [
        'The limit is silently reduced',
        'The Pod creation is rejected',
        'The LimitRange is updated',
        'The container runs without a limit'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does defaultRequest in a LimitRange provide?',
      options: [
        'Maximum allowed request',
        'Default value for requests when container omits them',
        'Minimum number of Pods',
        'ResourceQuota override'
      ],
      correctAnswer: 1
    }
  ]
}
