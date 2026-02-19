// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Common Annotations
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which prefix is reserved for Kubernetes annotations?',
      options: [
        'kube.io/',
        'kubernetes.io/ and k8s.io/',
        'reserved.io/',
        'system.io/'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What should you use for custom application annotations?',
      options: [
        'kubernetes.io/ prefix',
        'Your own domain (e.g., mycompany.com/feature)',
        'k8s.io/ prefix',
        'No prefix'
      ],
      correctAnswer: 1
    }
  ]
}
