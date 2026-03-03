// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What are Limit Ranges?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What is the main difference between LimitRange and ResourceQuota?',
      options: [
        'LimitRange applies cluster-wide; ResourceQuota is per namespace',
        'LimitRange applies to individual objects; ResourceQuota limits aggregate namespace usage',
        'LimitRange only affects CPU; ResourceQuota affects memory',
        'There is no difference'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'When does a LimitRange apply default requests/limits to a container?',
      options: [
        'When the Pod is deleted',
        'When the container omits requests or limits',
        'Only during node maintenance',
        'Never; defaults are only advisory'
      ],
      correctAnswer: 1
    }
  ]
}
