// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Log Aggregation Patterns
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Why use a DaemonSet for log collection?',
      options: [
        'To reduce resource usage',
        'To run one collector per node and capture all container logs',
        'To replace the kubelet',
        'To encrypt logs'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is a benefit of structured logging (e.g., JSON)?',
      options: [
        'Smaller log size',
        'Easier parsing and querying in the backend',
        'Faster write speed',
        'Automatic compression'
      ],
      correctAnswer: 1
    }
  ]
}
