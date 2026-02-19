// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - ClusterIP Service
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the default Service type in Kubernetes?',
      options: ['NodePort', 'LoadBalancer', 'ClusterIP', 'ExternalName'],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Where can a ClusterIP Service be accessed from?',
      options: [
        'Only from outside the cluster',
        'Only from within the cluster',
        'From anywhere',
        'Only from the control plane'
      ],
      correctAnswer: 1
    }
  ]
}
