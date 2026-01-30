// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a Service?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What problem do Services solve in Kubernetes?',
      options: [
        'Container image management',
        'Stable network access to dynamic Pods',
        'Pod scheduling',
        'Resource limits',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What does a Service provide?',
      options: [
        'A stable IP address and DNS name for a set of Pods',
        'Container runtime',
        'Pod scheduling',
        'Image registry',
      ],
      correctAnswer: 0,
    },
  ],
};
