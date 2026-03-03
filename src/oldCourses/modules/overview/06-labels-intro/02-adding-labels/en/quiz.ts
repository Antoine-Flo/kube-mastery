// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Adding Labels
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'To change an existing label value, which flag do you need?',
      options: ['--replace', '--overwrite', '--force', '--update'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Where do you add labels when creating a Pod via YAML?',
      options: [
        'spec.labels',
        'metadata.labels',
        'annotations.labels',
        'template.labels'
      ],
      correctAnswer: 1
    }
  ]
}
