// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Dynamic Provisioning with StorageClass
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'When does dynamic provisioning create a PV?',
      options: [
        'When a StorageClass is created',
        'When a PVC requests a StorageClass that has a provisioner',
        'When a Pod is scheduled',
        'When the cluster starts'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What happens if a PVC uses a StorageClass with no provisioner?',
      options: [
        'A default provisioner is used',
        'The PVC stays Pending until a matching PV is created manually',
        'The PVC is rejected',
        'emptyDir is used instead'
      ],
      correctAnswer: 1
    }
  ]
}
