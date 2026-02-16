// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Metrics Overview
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which component provides resource metrics (CPU, memory) for kubectl top?',
      options: [
        'kube-state-metrics',
        'cAdvisor',
        'metrics-server',
        'Prometheus'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Does the metrics-server store historical data?',
      options: [
        'Yes, for 7 days by default',
        'Yes, for 24 hours',
        'No, it only provides current metrics',
        'Only for node metrics'
      ],
      correctAnswer: 2
    }
  ]
}
