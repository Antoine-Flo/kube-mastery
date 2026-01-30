// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Using ConfigMaps
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'How are ConfigMaps consumed as environment variables updated?',
      options: [
        'Automatically when the ConfigMap changes',
        'They require a pod restart',
        'They update immediately',
        'They never update',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What must be true for a Pod to use a ConfigMap?',
      options: [
        'They must be in different namespaces',
        'They must be in the same namespace',
        'The ConfigMap must be in the default namespace',
        'Namespace doesn\'t matter',
      ],
      correctAnswer: 1,
    },
  ],
};
