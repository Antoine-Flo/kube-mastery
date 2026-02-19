// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a ServiceAccount
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Where is the ServiceAccount token mounted in a Pod?',
      options: [
        '/etc/kubernetes/token',
        '/var/run/secrets/kubernetes.io/serviceaccount/token',
        '/tmp/sa-token',
        '/secrets/serviceaccount'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Where do you specify the ServiceAccount in a Pod?',
      options: [
        'metadata.serviceAccountName',
        'spec.serviceAccountName',
        'spec.containers[0].serviceAccount',
        'annotations.serviceAccount'
      ],
      correctAnswer: 1
    }
  ]
}
