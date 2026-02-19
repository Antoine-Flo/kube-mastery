// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Kubernetes DNS
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the full DNS name format for a Service?',
      options: [
        '<service>.cluster.local',
        '<service>.<namespace>.svc.cluster.local',
        '<namespace>/<service>',
        '<service>-<namespace>.dns'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'From a Pod in the same namespace, how do you reach a Service named "api"?',
      options: [
        'api.svc.cluster.local',
        'api (short name works)',
        'api.default.namespace',
        'svc/api'
      ],
      correctAnswer: 1
    }
  ]
}
