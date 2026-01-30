// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating Your First Pod
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz';

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the correct apiVersion for a Pod object?',
      options: [
        'apps/v1',
        'v1',
        'v1beta1',
        'batch/v1',
      ],
      correctAnswer: 1,
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is the first step Kubernetes performs when you apply a Pod manifest?',
      options: [
        'Pulling the container image',
        'Scheduling the Pod to a node',
        'Validation of the manifest',
        'Starting the container',
      ],
      correctAnswer: 2,
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'What happens if you try to create a Pod with a name that already exists in the same namespace?',
      options: [
        'The existing Pod is replaced',
        'A new Pod is created with a suffix',
        'Kubernetes rejects the request',
        'The Pods are merged together',
      ],
      correctAnswer: 2,
    },
  ],
};
