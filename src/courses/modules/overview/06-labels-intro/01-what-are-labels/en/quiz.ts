// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What Are Labels?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What are labels used for?',
      options: [
        'Storing large configuration data',
        'Identifying attributes meaningful to users',
        'Defining resource limits',
        'Encrypting object metadata'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What uses labels to identify sets of objects?',
      options: [
        'ConfigMaps',
        'Secrets',
        'Selectors',
        'Namespaces'
      ],
      correctAnswer: 2
    }
  ]
}
