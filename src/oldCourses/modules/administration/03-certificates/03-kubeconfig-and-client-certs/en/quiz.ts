// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - kubeconfig and Client Certificates
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does kubeconfig typically contain for certificate-based auth?',
      options: [
        'Only the API server URL',
        'client-certificate and client-key paths',
        'A ServiceAccount token only',
        'etcd connection details'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Who verifies the client certificate when kubectl connects to the API server?',
      options: [
        'The kubelet',
        'The API server',
        'etcd',
        'The scheduler'
      ],
      correctAnswer: 1
    }
  ]
}
