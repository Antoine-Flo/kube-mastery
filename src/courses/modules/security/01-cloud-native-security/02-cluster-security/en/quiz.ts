// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Cluster Security Basics
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Why should you enable encryption at rest for etcd?',
      options: [
        'To improve performance',
        'To protect sensitive data such as Secrets stored in etcd',
        'To enable TLS for the API server',
        'To compress data'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does readOnlyRootFilesystem in a securityContext do?',
      options: [
        'Makes the container run as root',
        'Makes the root filesystem read-only for the container',
        'Disables all file system access',
        'Encrypts the root filesystem'
      ],
      correctAnswer: 1
    }
  ]
}
