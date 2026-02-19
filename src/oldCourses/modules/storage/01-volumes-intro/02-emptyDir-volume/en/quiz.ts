// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - emptyDir Volume
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'When is an emptyDir volume created?',
      options: [
        'When the cluster is initialized',
        'When the Pod is assigned to a node',
        'When the first container starts',
        'When a PersistentVolumeClaim is bound'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What happens to emptyDir data when the Pod is removed?',
      options: [
        'Data is migrated to another Pod',
        'Data is deleted',
        'Data is backed up to etcd',
        'Data persists until manually deleted'
      ],
      correctAnswer: 1
    }
  ]
}
