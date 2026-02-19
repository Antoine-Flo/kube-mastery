// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Node-Level Logging
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Where are container logs typically stored on the node?',
      options: [
        'In etcd',
        'Under /var/log/pods or similar runtime directory',
        'In the API server',
        'In a ConfigMap'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Why might node-level logs be lost?',
      options: [
        'They are encrypted',
        'When a Pod is rescheduled or a node is replaced',
        'After 24 hours always',
        'Only when explicitly deleted'
      ],
      correctAnswer: 1
    }
  ]
}
