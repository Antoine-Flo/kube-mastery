// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Verbs and Resources
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which verb allows reading a single resource by name?',
      options: ['list', 'watch', 'get', 'read'],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'For core API resources like Pods, what apiGroups value is used?',
      options: ['["core"]', '["v1"]', '[""]', '["kubernetes.io"]'],
      correctAnswer: 2
    }
  ]
}
