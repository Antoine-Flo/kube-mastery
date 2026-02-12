// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Service Selectors
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How does a Service determine which Pods to target?',
      options: [
        'By Pod name',
        'By Pod IP address',
        'By label selectors',
        'By namespace'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What objects does Kubernetes automatically create for a Service with a selector?',
      options: ['ConfigMaps', 'Secrets', 'EndpointSlices', 'Deployments'],
      correctAnswer: 2
    }
  ]
}
