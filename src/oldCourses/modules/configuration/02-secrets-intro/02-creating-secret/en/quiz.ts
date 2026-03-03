// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating Secrets
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What is the advantage of using stringData instead of data in a Secret?',
      options: [
        'stringData provides stronger encryption',
        'stringData accepts plain text; Kubernetes encodes it automatically',
        'stringData is faster',
        'data is deprecated'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Which Secret type is used for private container registry credentials?',
      options: [
        'Opaque',
        'kubernetes.io/tls',
        'kubernetes.io/dockerconfigjson',
        'kubernetes.io/basic-auth'
      ],
      correctAnswer: 2
    }
  ]
}
