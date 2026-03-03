// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Certificate Rotation
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Which command renews control plane certificates in a kubeadm cluster?',
      options: [
        'kubectl certs renew',
        'kubeadm certs renew all',
        'openssl renew',
        'kubelet --rotate-certs'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Why should you rotate certificates before they expire?',
      options: [
        'To reduce certificate size',
        'To avoid cluster outage when certs expire',
        'To enable TLS 1.3',
        'To change the CA'
      ],
      correctAnswer: 1
    }
  ]
}
