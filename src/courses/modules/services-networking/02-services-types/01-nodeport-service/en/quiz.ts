// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - NodePort Service
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the default port range for NodePort Services?',
      options: [
        '1000-2000',
        '30000-32767',
        '8000-9000',
        '50000-60000',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'How do you access a NodePort Service from outside the cluster?',
      options: [
        'Using the Service cluster IP',
        'Using <NodeIP>:<nodePort>',
        'Using DNS only',
        'You cannot access it from outside',
      ],
      correctAnswer: 1,
    },
  ],
};
