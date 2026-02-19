// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - API Request Flow
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'In what order do authentication, authorization, and admission control run?',
      options: [
        'Admission, Authentication, Authorization',
        'Authentication, Authorization, Admission',
        'Authorization, Authentication, Admission',
        'They run in parallel'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does the authentication stage answer?',
      options: [
        'What can the user do?',
        'Who is making the request?',
        'Should the request be modified?',
        'Which namespace is targeted?'
      ],
      correctAnswer: 1
    }
  ]
}
