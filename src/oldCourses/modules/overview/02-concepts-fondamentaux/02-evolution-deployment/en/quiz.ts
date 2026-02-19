// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Evolution of Deployment
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What was the main problem with traditional deployment on physical servers?',
      options: [
        'Too expensive to maintain',
        'No way to define resource boundaries, causing allocation issues',
        "Applications couldn't communicate",
        'Too slow to deploy'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What is the key difference between containers and virtual machines?',
      options: [
        'Containers are more expensive',
        'Containers share the Operating System among applications',
        'VMs are lighter weight',
        'Containers require more hardware'
      ],
      correctAnswer: 1
    }
  ]
}
