// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a ConfigMap
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'terminal-command',
      question: 'Create a ConfigMap named my-config with a key-value pair: key1=value1',
      expectedCommand: 'kubectl create configmap my-config --from-literal=key1=value1',
      validationMode: 'contains',
      normalizeCommand: true
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
