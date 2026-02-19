// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Prometheus and Alerting
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How does Prometheus collect metrics?',
      options: [
        'Applications push metrics to Prometheus',
        'Prometheus scrapes (pulls) metrics from targets',
        'It reads from etcd',
        'It uses the Kubernetes Metrics API only'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What annotation can enable Prometheus to scrape a Pod?',
      options: [
        'metrics.kubernetes.io/enable: "true"',
        'prometheus.io/scrape: "true"',
        'monitoring.io/prometheus: "yes"',
        'scrape.prometheus.io: "true"'
      ],
      correctAnswer: 1
    }
  ]
}
