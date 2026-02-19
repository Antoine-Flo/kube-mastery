// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Selectors de Service
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Comment un Service détermine-t-il quels Pods cibler ?',
      options: [
        'Par nom de Pod',
        'Par adresse IP de Pod',
        'Par selectors de labels',
        'Par namespace'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Quels objets Kubernetes crée-t-il automatiquement pour un Service avec un selector ?',
      options: ['ConfigMaps', 'Secrets', 'EndpointSlices', 'Deployments'],
      correctAnswer: 2
    }
  ]
}
