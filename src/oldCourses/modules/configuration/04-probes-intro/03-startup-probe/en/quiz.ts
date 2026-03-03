import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the main purpose of a startup probe?',
      options: [
        'Route traffic to a Pod',
        'Delay liveness and readiness checks until app startup completes',
        'Scale Deployments automatically',
        'Encrypt Pod communication'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'When a startup probe is configured, what happens before it succeeds?',
      options: [
        'Only readiness probe runs',
        'Liveness and readiness probes are disabled',
        'All probes run in parallel',
        'The Pod is immediately restarted'
      ],
      correctAnswer: 1
    }
  ]
}
