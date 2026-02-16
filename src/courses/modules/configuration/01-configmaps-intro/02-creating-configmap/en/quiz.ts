// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a ConfigMap
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question:
        'Create a ConfigMap named my-config with a key-value pair: key1=value1',
      options: [
        'kubectl create configmap my-config --from-literal=key1=value1',
        'kubectl create cm my-config key1=value1',
        'kubectl apply configmap my-config --literal key1=value1',
        'kubectl new configmap my-config key1=value1'
      ],
      correctAnswer: 0
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What is the correct apiVersion for a ConfigMap object?',
      options: ['apps/v1', 'v1', 'v1beta1', 'batch/v1'],
      correctAnswer: 1
    }
  ]
}
