// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - DNS Configuration
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the default dnsPolicy for most Pods?',
      options: ['Default', 'ClusterFirst', 'None', 'ClusterFirstWithHostNet'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'When using dnsPolicy: None, what is required?',
      options: [
        'Nothing else',
        'dnsConfig must be provided',
        'A ConfigMap named dns-config',
        'clusterDNS must be set'
      ],
      correctAnswer: 1
    }
  ]
}
