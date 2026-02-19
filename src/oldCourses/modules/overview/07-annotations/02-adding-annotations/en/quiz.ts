// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Adding Annotations
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How do you remove an annotation with kubectl annotate?',
      options: [
        'Use --remove flag',
        'Add a hyphen after the key: key-',
        'Use kubectl delete annotation',
        'Set the value to empty string'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Where do annotations go in a Pod manifest?',
      options: [
        'spec.annotations',
        'metadata.annotations',
        'status.annotations',
        'labels.annotations'
      ],
      correctAnswer: 1
    }
  ]
}
