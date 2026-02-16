// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Operator SDK and Frameworks
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does the Operator SDK help with?',
      options: [
        'Replacing the API server',
        'Building Operators with less boilerplate',
        'Managing node certificates',
        'Scaling the control plane'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does the controller Reconcile() function do?',
      options: [
        'Deletes all resources',
        'Processes events and brings actual state in line with desired state',
        'Only validates CRDs',
        'Manages etcd backups'
      ],
      correctAnswer: 1
    }
  ]
}
