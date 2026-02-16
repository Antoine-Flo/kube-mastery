// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Authentication Methods in kubeconfig
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which authentication method runs an external command to obtain credentials?',
      options: [
        'client-certificate',
        'token',
        'exec',
        'basicAuth'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is a common use case for exec-based authentication?',
      options: [
        'Static token storage',
        'Cloud provider authentication (e.g., EKS, GKE)',
        'Client certificates only',
        'Basic auth with username/password'
      ],
      correctAnswer: 1
    }
  ]
}
