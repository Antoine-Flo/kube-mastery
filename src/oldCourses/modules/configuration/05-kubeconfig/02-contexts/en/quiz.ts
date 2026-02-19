// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Working with Contexts
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What determines which context kubectl uses by default?',
      options: [
        'The first context in the file',
        'The current-context field',
        'The KUBECONFIG environment variable',
        'The cluster name'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What can a context optionally specify in addition to cluster and user?',
      options: [
        'Container image',
        'Default namespace',
        'Resource limits',
        'Service account'
      ],
      correctAnswer: 1
    }
  ]
}
