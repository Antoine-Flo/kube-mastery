// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - ConfigMap and Secret Volumes
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'When you mount a ConfigMap as a volume, what do ConfigMap keys become?',
      options: [
        'Environment variable names',
        'Filenames in the mounted directory',
        'Volume names',
        'Container command arguments'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Are ConfigMap volumes writable by default?',
      options: [
        'Yes, always writable',
        'No, they are read-only by default',
        'Only in development namespaces',
        'Only when using readOnly: false'
      ],
      correctAnswer: 1
    }
  ]
}
