// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Choosing a Service Type
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Which Service type should you use for internal cluster communication only?',
      options: ['NodePort', 'LoadBalancer', 'ClusterIP', 'ExternalName'],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Which Service type is best for exposing services externally on cloud platforms?',
      options: ['ClusterIP', 'NodePort', 'LoadBalancer', 'ExternalName'],
      correctAnswer: 2
    }
  ]
}
