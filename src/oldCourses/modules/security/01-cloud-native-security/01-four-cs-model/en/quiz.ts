// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - The 4C Security Model
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'What are the four layers of the 4C security model, from outside in?',
      options: [
        'Code, Container, Cluster, Cloud',
        'Cloud, Cluster, Container, Code',
        'Cluster, Cloud, Code, Container',
        'Container, Code, Cloud, Cluster'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Why is defense in depth important?',
      options: [
        'It reduces latency',
        'A vulnerability in an outer layer can compromise inner layers',
        'It simplifies configuration',
        'It improves scalability'
      ],
      correctAnswer: 1
    }
  ]
}
