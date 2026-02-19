// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What are PV and PVC?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a PersistentVolumeClaim represent?',
      options: [
        'A physical disk in the cluster',
        'A request for storage by a user',
        'A StorageClass definition',
        'A volume mount path'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Who typically provisions PersistentVolumes?',
      options: [
        'Application developers',
        'Cluster administrators or StorageClasses',
        'End users only',
        'The kubelet automatically'
      ],
      correctAnswer: 1
    }
  ]
}
