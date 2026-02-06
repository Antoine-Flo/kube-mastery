// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Pod Structure
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How do containers within the same Pod communicate with each other?',
      options: ['Using external IP addresses', 'Using localhost', 'They cannot communicate', 'Using Service IPs'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What shared resources do Pods provide to their containers?',
      options: ['Only networking', 'Only storage', 'Networking and storage', 'Neither networking nor storage'],
      correctAnswer: 2
    }
  ]
}
