// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - fsGroup and File Permissions
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does fsGroup control?',
      options: [
        'The user ID of the main process',
        'The group ownership of mounted volumes',
        'The root filesystem',
        'Network permissions'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'At which level is fsGroup specified?',
      options: [
        'Container level only',
        'Pod level',
        'Volume level',
        'Namespace level'
      ],
      correctAnswer: 1
    }
  ]
}
