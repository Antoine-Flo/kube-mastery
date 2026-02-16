// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What Are Annotations?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the main difference between labels and annotations?',
      options: [
        'Annotations have shorter keys',
        'Annotations are not used for object selection',
        'Labels store larger data',
        'Annotations are required, labels are optional'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What are annotations typically used for?',
      options: [
        'Selecting Pods for Services',
        'Storing metadata for tools or external systems',
        'Defining resource quotas',
        'Namespace isolation'
      ],
      correctAnswer: 1
    }
  ]
}
