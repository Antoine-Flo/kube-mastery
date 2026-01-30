// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Restart Policies
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the default restart policy for a Pod?',
      options: [
        'Never',
        'OnFailure',
        'Always',
        'OnSuccess',
      ],
      correctAnswer: 2,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which restart policy only restarts containers that exit with an error?',
      options: [
        'Always',
        'OnFailure',
        'Never',
        'OnError',
      ],
      correctAnswer: 1,
    },
  ],
};
