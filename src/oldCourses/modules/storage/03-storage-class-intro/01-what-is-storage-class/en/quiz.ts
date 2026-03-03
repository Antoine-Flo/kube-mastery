// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a StorageClass?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a StorageClass provisioner do?',
      options: [
        'Deletes PVCs',
        'Dynamically creates PersistentVolumes when a PVC is created',
        'Manages Pod scheduling',
        'Configures network storage'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What benefit does WaitForFirstConsumer volume binding provide?',
      options: [
        'Faster PVC creation',
        'Delays binding until a Pod uses the PVC, improving scheduling',
        'Reduces storage cost',
        'Enables read-only access'
      ],
      correctAnswer: 1
    }
  ]
}
