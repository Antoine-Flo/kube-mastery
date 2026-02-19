// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Edit and Delete
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does kubectl edit do?',
      options: [
        'Creates a backup before editing',
        'Opens the object in your editor; changes apply on save',
        'Only shows the object, does not allow edits',
        'Requires a -f flag to work'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'When you delete a Deployment, what happens to its Pods?',
      options: [
        'They are orphaned immediately',
        'The ReplicaSet controller may recreate them until the Deployment is fully removed',
        'They are never recreated',
        'Only the Deployment is deleted, Pods remain forever'
      ],
      correctAnswer: 1
    }
  ]
}
