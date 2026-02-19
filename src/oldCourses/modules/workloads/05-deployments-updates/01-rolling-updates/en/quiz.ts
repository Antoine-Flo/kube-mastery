// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Rolling Updates
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What triggers a Deployment rollout?',
      options: [
        'Scaling the Deployment',
        "Changing the Deployment's Pod template",
        'Deleting a Pod',
        'Creating a Service'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What is the default maximum percentage of unavailable Pods during a rolling update?',
      options: ['10%', '25%', '50%', '75%'],
      correctAnswer: 1
    }
  ]
}
