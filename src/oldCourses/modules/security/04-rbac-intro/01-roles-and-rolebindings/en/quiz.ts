// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Roles and RoleBindings
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the scope of a Role?',
      options: [
        'Cluster-wide',
        'Namespace-scoped',
        'Node-scoped',
        'Pod-scoped'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does a RoleBinding do?',
      options: [
        'Defines which resources exist',
        'Links a Role to users, groups, or ServiceAccounts',
        'Creates a new Role',
        'Deletes permissions'
      ],
      correctAnswer: 1
    }
  ]
}
