// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - ServiceAccount Tokens and RBAC
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'How does a ServiceAccount get permissions to perform API operations?',
      options: [
        'Automatically; all ServiceAccounts have full access',
        'Through RBAC RoleBindings or ClusterRoleBindings',
        'Through the Pod spec',
        'Through the ServiceAccount manifest'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'What identity format does the API server use for ServiceAccount tokens?',
      options: [
        'system:user:sa-name',
        'system:serviceaccount:<namespace>:<serviceaccount-name>',
        'serviceaccount:<name>',
        'pod:<namespace>:<pod-name>'
      ],
      correctAnswer: 1
    }
  ]
}
