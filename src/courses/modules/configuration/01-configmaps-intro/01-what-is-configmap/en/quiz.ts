// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a ConfigMap?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is a ConfigMap used for?',
      options: [
        'Storing secrets and passwords',
        'Storing configuration data separately from application code',
        'Storing container images',
        'Storing Pod definitions',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What should you use instead of ConfigMap for confidential data?',
      options: [
        'Another ConfigMap',
        'A Secret',
        'Environment variables',
        'A Deployment',
      ],
      correctAnswer: 1,
    },
  ],
};
