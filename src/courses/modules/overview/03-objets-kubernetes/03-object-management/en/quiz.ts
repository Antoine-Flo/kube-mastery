// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Object Management
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Which management technique automatically detects create, update, and delete operations?',
      options: [
        'Imperative commands',
        'Imperative object configuration',
        'Declarative object configuration',
        'All of the above'
      ],
      correctAnswer: 2
    },
    {
      id: 'q2',
      type: 'terminal-command',
      question: 'Create a deployment named nginx using the imperative command approach',
      expectedCommand: 'kubectl create deployment nginx --image nginx',
      validationMode: 'contains',
      normalizeCommand: true
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'What is the recommended approach for managing Kubernetes objects in production?',
      options: [
        'Only imperative commands',
        'Only declarative object configuration',
        'Mix imperative and declarative approaches',
        'Use only one technique per object'
      ],
      correctAnswer: 3
    }
  ]
}
