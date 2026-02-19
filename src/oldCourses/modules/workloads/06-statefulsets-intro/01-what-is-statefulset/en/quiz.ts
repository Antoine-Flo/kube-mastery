// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a StatefulSet?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What type of applications are StatefulSets designed for?',
      options: [
        'Stateless web servers',
        'Stateful applications with stable identity',
        'One-off batch jobs',
        'Cron jobs only'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does a StatefulSet require for network identity?',
      options: [
        'LoadBalancer Service',
        'Headless Service',
        'NodePort Service',
        'ClusterIP Service only'
      ],
      correctAnswer: 1
    }
  ]
}
