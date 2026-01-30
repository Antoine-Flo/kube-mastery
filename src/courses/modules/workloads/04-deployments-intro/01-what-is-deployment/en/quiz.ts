// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - What is a Deployment?
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What does a Deployment manage?',
      options: [
        'Only Pods directly',
        'ReplicaSets, which manage Pods',
        'Services',
        'ConfigMaps',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What type of applications are Deployments best suited for?',
      options: [
        'Stateful applications',
        'Stateless applications',
        'Database applications',
        'Only batch jobs',
      ],
      correctAnswer: 1,
    },
  ],
};
