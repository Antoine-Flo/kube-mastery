// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - ExternalName Service
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does an ExternalName Service map to?',
      options: ['A set of Pods', 'A DNS name', 'A cluster IP', 'A node port'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How does an ExternalName Service redirect traffic?',
      options: ['Via proxying', 'At the DNS level using CNAME records', 'Via load balancing', 'Via port forwarding'],
      correctAnswer: 1
    }
  ]
}
