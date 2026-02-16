// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - kube-state-metrics
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does kube-state-metrics expose?',
      options: [
        'Container CPU and memory usage',
        'Kubernetes object state (Deployments, Pods, etc.)',
        'Node disk usage',
        'Network throughput'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Does kube-state-metrics track resource usage (CPU, memory)?',
      options: [
        'Yes, for all resources',
        'Yes, for Pods only',
        'No, it tracks object counts and status',
        'Only when using Prometheus'
      ],
      correctAnswer: 2
    }
  ]
}
