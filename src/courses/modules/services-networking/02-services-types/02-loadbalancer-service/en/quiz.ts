// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - LoadBalancer Service
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a LoadBalancer Service provide?',
      options: [
        'Internal cluster IP only',
        'External load balancer for accessing the Service',
        'DNS CNAME record',
        'Only NodePort functionality'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Where is information about the provisioned load balancer published?',
      options: [
        'In the Service spec',
        'In the Service status.loadBalancer field',
        'In Pod annotations',
        'In ConfigMaps'
      ],
      correctAnswer: 1
    }
  ]
}
