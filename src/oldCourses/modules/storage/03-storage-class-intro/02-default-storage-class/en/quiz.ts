// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Default StorageClass
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'When does a PVC use the default StorageClass?',
      options: [
        'When storageClassName is explicitly set',
        'When storageClassName is omitted',
        'When using ReadWriteOnce access mode',
        'Only in the default namespace'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How is a StorageClass marked as default?',
      options: [
        'By naming it "default"',
        'With annotation storageclass.kubernetes.io/is-default-class: "true"',
        'By being the first one created',
        'Via a ConfigMap'
      ],
      correctAnswer: 1
    }
  ]
}
