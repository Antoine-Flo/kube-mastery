// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Pod Conditions
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Which Pod condition indicates that the Pod can serve requests?',
      options: ['PodScheduled', 'Initialized', 'Ready', 'ContainersReady'],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What are the possible status values for a Pod condition?',
      options: [
        'True, False',
        'True, False, Unknown',
        'Active, Inactive',
        'Ready, NotReady'
      ],
      correctAnswer: 1
    }
  ]
}
