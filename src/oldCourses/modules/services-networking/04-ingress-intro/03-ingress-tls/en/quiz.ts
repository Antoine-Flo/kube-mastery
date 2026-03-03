// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Ingress and TLS
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Where is the TLS certificate stored for Ingress?',
      options: [
        'In the Ingress spec',
        'In a Secret referenced by secretName',
        'In a ConfigMap',
        'In the Service'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'In which namespace must the TLS Secret be for the Ingress to use it?',
      options: [
        'kube-system',
        'Same namespace as the Ingress',
        'default only',
        'Any namespace'
      ],
      correctAnswer: 1
    }
  ]
}
