// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Service Discovery
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the recommended method for service discovery in Kubernetes?',
      options: [
        'Environment variables only',
        'DNS',
        'Hard-coded IP addresses',
        'ConfigMaps',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'If using environment variables for service discovery, when must the Service be created?',
      options: [
        'After the client Pods',
        'Before the client Pods',
        'At the same time',
        'It doesn\'t matter',
      ],
      correctAnswer: 1,
    },
  ],
};
