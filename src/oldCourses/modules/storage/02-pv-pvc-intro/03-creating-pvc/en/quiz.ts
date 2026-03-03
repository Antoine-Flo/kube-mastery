// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a PersistentVolumeClaim
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How does a Pod reference a PersistentVolumeClaim?',
      options: [
        'By PV name',
        'By claimName in the volume spec',
        'By StorageClass name',
        'By node label'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What happens when a PVC is created and a matching StorageClass has a provisioner?',
      options: [
        'The PVC remains Pending forever',
        'A new PV can be provisioned automatically',
        'The Pod must be created first',
        'You must manually create the PV'
      ],
      correctAnswer: 1
    }
  ]
}
