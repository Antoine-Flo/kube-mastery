// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Krew Plugin Manager
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does Krew provide?',
      options: [
        'A replacement for kubectl',
        'Discovery, installation, and management of kubectl plugins',
        'Cluster backup',
        'Certificate management'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which command installs a plugin via Krew?',
      options: [
        'kubectl install krew <plugin>',
        'kubectl krew install <plugin>',
        'krew add <plugin>',
        'kubectl plugin install <plugin>'
      ],
      correctAnswer: 1
    }
  ]
}
