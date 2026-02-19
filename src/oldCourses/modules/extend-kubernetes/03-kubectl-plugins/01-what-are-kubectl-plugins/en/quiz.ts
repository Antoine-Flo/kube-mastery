// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What are kubectl Plugins?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How must a kubectl plugin executable be named?',
      options: [
        'plugin-<name>',
        'kubectl-<name>',
        'kubectl-plugin-<name>',
        '<name>-kubectl'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How do you list installed kubectl plugins?',
      options: [
        'kubectl list plugins',
        'kubectl plugin list',
        'kubectl --plugins',
        'kubectl get plugins'
      ],
      correctAnswer: 1
    }
  ]
}
