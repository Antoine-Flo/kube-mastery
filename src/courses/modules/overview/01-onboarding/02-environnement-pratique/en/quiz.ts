// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Your practice environment (kubectl + cluster)
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'Create a new file called "test.txt"',
      options: [
        'touch test.txt',
        'create test.txt',
        'nano --new test.txt',
        'kubectl create file test.txt'
      ],
      correctAnswer: 0,
      hint: 'Use the shell command that creates an empty file.'
    }
  ]
}
