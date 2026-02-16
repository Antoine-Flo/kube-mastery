// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Admission Control
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the difference between a validating and a mutating admission controller?',
      options: [
        'Validating modifies requests; mutating only checks them',
        'Validating checks if the request is allowed; mutating can modify the request',
        'They are the same',
        'Validating runs first, mutating runs after'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which admission controller enforces Pod Security Standards?',
      options: [
        'ResourceQuota',
        'LimitRanger',
        'PodSecurity',
        'ServiceAccount'
      ],
      correctAnswer: 2
    }
  ]
}
