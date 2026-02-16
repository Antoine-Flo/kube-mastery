// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Kubernetes PKI Overview
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What signs certificates for Kubernetes components?',
      options: [
        'An external CA only',
        'The cluster CA (Certificate Authority)',
        'The kubelet',
        'etcd'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Where are Kubernetes PKI certificate files typically stored?',
      options: [
        '/var/lib/etcd',
        '/etc/kubernetes/pki',
        '/var/log/kubernetes',
        '/opt/kubeadm'
      ],
      correctAnswer: 1
    }
  ]
}
