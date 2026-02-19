// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - QoS Classes
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'When is a Pod assigned the Guaranteed QoS class?',
      options: [
        'When it has no resource settings',
        'When all containers have requests and limits set and they are equal',
        'When it has only requests set',
        'When it has only limits set'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which QoS class is evicted first when a node is under memory pressure?',
      options: [
        'Guaranteed',
        'Burstable',
        'BestEffort',
        'All are evicted equally'
      ],
      correctAnswer: 2
    }
  ]
}
