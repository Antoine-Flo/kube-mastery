// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - ClusterRoles and ClusterRoleBindings
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the scope of a ClusterRoleBinding?',
      options: [
        'A single namespace',
        'Cluster-wide (all namespaces)',
        'A single node',
        'A single Pod'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Can a RoleBinding reference a ClusterRole?',
      options: [
        'No, RoleBinding can only reference a Role',
        'Yes; it grants the ClusterRole permissions within the RoleBinding namespace only',
        'Yes; it then applies cluster-wide',
        'Only for built-in ClusterRoles'
      ],
      correctAnswer: 1
    }
  ]
}
