// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Spec and Status
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does the "spec" field in a Kubernetes object represent?',
      options: [
        'The current state of the object',
        'The desired state of the object',
        'The object\'s metadata',
        'The object\'s status',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Who updates the "status" field of a Kubernetes object?',
      options: [
        'The user who created the object',
        'The Kubernetes system and its components',
        'The container runtime',
        'The kubectl tool',
      ],
      correctAnswer: 1,
    },
  ],
};
