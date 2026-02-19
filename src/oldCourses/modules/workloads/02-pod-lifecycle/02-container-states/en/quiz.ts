// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Container States
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What are the three possible container states in a Pod?',
      options: [
        'Pending, Running, Failed',
        'Waiting, Running, Terminated',
        'Starting, Active, Stopped',
        'Init, Running, Complete'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'A container is pulling its image. What state is it in?',
      options: ['Running', 'Terminated', 'Waiting', 'Pending'],
      correctAnswer: 2
    }
  ]
}
