// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a Simple kubectl Plugin
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a kubectl plugin inherit from the environment?',
      options: [
        'Only the current namespace',
        'KUBECONFIG (and thus cluster context)',
        'Nothing; it must be configured separately',
        'Only the default context name'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How can a plugin interact with the cluster?',
      options: [
        'Only via environment variables',
        'Via kubectl subprocess, curl to the API, or client libraries',
        'Only via client-go',
        'Plugins cannot access the cluster'
      ],
      correctAnswer: 1
    }
  ]
}
