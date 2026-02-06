// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Pod Phases
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What Pod phase indicates that all containers have terminated successfully?',
      options: ['Running', 'Succeeded', 'Pending', 'Failed'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'In which phase is a Pod when it is waiting to be scheduled?',
      options: ['Running', 'Pending', 'Succeeded', 'Unknown'],
      correctAnswer: 1
    }
  ]
}
