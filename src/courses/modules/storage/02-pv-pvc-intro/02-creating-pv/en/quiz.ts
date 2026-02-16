// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a PersistentVolume
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which access mode allows read-write from a single node only?',
      options: [
        'ReadOnlyMany',
        'ReadWriteMany',
        'ReadWriteOnce',
        'ReadWriteAll'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does persistentVolumeReclaimPolicy control?',
      options: [
        'How PVs are provisioned',
        'What happens to the volume when the PVC is deleted',
        'Which nodes can mount the volume',
        'The storage backend type'
      ],
      correctAnswer: 1
    }
  ]
}
