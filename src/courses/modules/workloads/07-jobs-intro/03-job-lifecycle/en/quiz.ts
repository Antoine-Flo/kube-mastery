// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Job Lifecycle
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does ttlSecondsAfterFinished do?',
      options: [
        'Sets a timeout for Job execution',
        'Automatically deletes the Job after completion',
        'Controls retry delay between attempts',
        'Defines Job startup deadline'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How do you list Pods created by a Job?',
      options: [
        'kubectl get pods -l job-name=example-job',
        'kubectl get job-pods example-job',
        'kubectl get pods --job example-job',
        'kubectl list job example-job --pods'
      ],
      correctAnswer: 0
    }
  ]
}
