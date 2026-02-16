// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - How to use this platform
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does the telescope icon open?',
      options: [
        'The quiz panel',
        'The cluster visualizer',
        'The file browser',
        'The settings menu'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What command should you run to verify kubectl is working?',
      options: [
        'kubectl get pods',
        'kubectl version',
        'kubectl cluster-info',
        'kubectl config view'
      ],
      correctAnswer: 1
    }
  ]
}
