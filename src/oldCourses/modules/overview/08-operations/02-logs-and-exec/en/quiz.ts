// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Logs and Exec
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does the -f flag do with kubectl logs?',
      options: [
        'Force overwrite',
        'Stream/follow logs in real time',
        'Filter by timestamp',
        'Format output'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is the purpose of -- in kubectl exec?',
      options: [
        'Comment delimiter',
        'Separates kubectl options from the command run in the container',
        'Indicates default command',
        'Required for multi-container Pods'
      ],
      correctAnswer: 1
    }
  ]
}
