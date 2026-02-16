// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Imperative Commands
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the main advantage of imperative commands?',
      options: [
        'Version control and reproducibility',
        'Speed and simplicity for quick tasks',
        'Collaboration in team environments',
        'Automatic state reconciliation'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What limitation do imperative commands have?',
      options: [
        'They require YAML files',
        'They do not leave a record for version control',
        'They only work for Deployments',
        'They cannot create resources'
      ],
      correctAnswer: 1
    }
  ]
}
