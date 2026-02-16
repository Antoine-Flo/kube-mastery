// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Using Secrets in Pods
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which field do you use to inject a Secret value as an environment variable?',
      options: [
        'configMapKeyRef',
        'secretKeyRef',
        'secretRef',
        'envFrom'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Why should you mount Secrets with readOnly: true?',
      options: [
        'To improve performance',
        'To prevent containers from modifying the mounted files',
        'To enable encryption',
        'It is required by the API'
      ],
      correctAnswer: 1
    }
  ]
}
