// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Pod Security Enforcement Modes
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What happens to a Pod that violates the policy when enforce mode is set?',
      options: [
        'It is allowed with a warning',
        'It is rejected',
        'It is logged only',
        'It runs in a sandbox'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question:
        'Which mode is recommended first when migrating to a stricter policy?',
      options: [
        'enforce immediately',
        'audit or warn to identify non-compliant Pods, then enforce',
        'Only audit',
        'Skip warn'
      ],
      correctAnswer: 1
    }
  ]
}
