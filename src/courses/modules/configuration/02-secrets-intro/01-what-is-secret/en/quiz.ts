// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a Secret?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the main purpose of a Kubernetes Secret?',
      options: [
        'Storing non-sensitive configuration data',
        'Storing sensitive data like passwords and tokens',
        'Storing container images',
        'Storing Pod definitions'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How is Secret data stored by default in etcd?',
      options: [
        'Plain text',
        'Base64-encoded',
        'AES-256 encrypted',
        'Hashed'
      ],
      correctAnswer: 1
    }
  ]
}
