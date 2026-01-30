// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a ReplicaSet
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the correct apiVersion for a ReplicaSet object?',
      options: [
        'v1',
        'apps/v1',
        'v1beta1',
        'batch/v1',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'terminal-command',
      question: 'Create a ReplicaSet from a YAML file named replicaset.yaml',
      expectedCommand: 'kubectl apply -f replicaset.yaml',
      validationMode: 'contains',
      normalizeCommand: true,
    },
  ],
};
