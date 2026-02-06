// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Kubernetes Objects
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What are Kubernetes objects?',
      options: [
        'Temporary entities that exist only during execution',
        'Persistent entities that represent the state of your cluster',
        'Only container images',
        'Network configurations'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which of the following is NOT a required field in a Kubernetes object manifest?',
      options: ['apiVersion', 'kind', 'metadata', 'status'],
      correctAnswer: 3
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'What does the "kind" field specify in a Kubernetes object?',
      options: [
        'The API version to use',
        'The type of object to create (Pod, Deployment, etc.)',
        "The object's name",
        'The desired state'
      ],
      correctAnswer: 1
    }
  ]
}
