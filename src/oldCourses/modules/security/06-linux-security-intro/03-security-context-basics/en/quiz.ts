// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Security Context Basics
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does allowPrivilegeEscalation: false prevent?',
      options: [
        'All container processes',
        'A process from gaining more privileges than its parent',
        'Root from running',
        'All capability drops'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What can happen if you set readOnlyRootFilesystem: true for an app that writes to /tmp?',
      options: [
        'It will run faster',
        'The application may fail if it cannot write to /tmp',
        'Kubernetes will add an emptyDir automatically',
        'Nothing; /tmp is always writable'
      ],
      correctAnswer: 1
    }
  ]
}
