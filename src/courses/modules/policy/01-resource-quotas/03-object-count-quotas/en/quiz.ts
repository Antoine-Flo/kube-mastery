// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Object Count Quotas
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What can ResourceQuotas limit besides CPU and memory?',
      options: [
        'Only Pod count',
        'Number of API objects (ConfigMaps, Secrets, PVCs, Services, etc.)',
        'Node count',
        'Namespace count'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'If a quota limits persistentvolumeclaims to 10, what happens when creating an 11th PVC?',
      options: [
        'The smallest PVC is deleted',
        'Creation is rejected',
        'The quota is ignored',
        'The PVC is created in another namespace'
      ],
      correctAnswer: 1
    }
  ]
}
