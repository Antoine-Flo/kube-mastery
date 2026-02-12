// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is Kubernetes?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is Kubernetes primarily designed for?',
      options: [
        'Managing virtual machines',
        'Managing containerized workloads and services',
        'Building container images',
        'Providing a complete PaaS solution'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Which of the following is NOT a capability provided by Kubernetes?',
      options: [
        'Service discovery and load balancing',
        'Automated rollouts and rollbacks',
        'Building and compiling source code',
        'Self-healing containers'
      ],
      correctAnswer: 2
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'Kubernetes is best described as:',
      options: [
        'A traditional all-inclusive PaaS system',
        'A set of building blocks for building developer platforms',
        'A monolithic orchestration system',
        'A source code deployment tool'
      ],
      correctAnswer: 1
    }
  ]
}
