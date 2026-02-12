// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - ReplicaSet Selectors
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        "What must match between a ReplicaSet's selector and pod template labels?",
      options: [
        'Nothing needs to match',
        'The selector and pod template labels must match',
        'Only the image name',
        'Only the namespace'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How does a ReplicaSet link to its Pods?',
      options: [
        'Through Service selectors',
        "Through Pods' metadata.ownerReferences field",
        'Through ConfigMaps',
        'Through Secrets'
      ],
      correctAnswer: 1
    }
  ]
}
