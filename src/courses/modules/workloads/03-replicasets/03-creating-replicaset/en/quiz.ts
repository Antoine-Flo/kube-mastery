// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Creating a ReplicaSet
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the correct apiVersion for a ReplicaSet object?',
      options: ['v1', 'apps/v1', 'v1beta1', 'batch/v1'],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Create a ReplicaSet from a YAML file named replicaset.yaml',
      options: [
        'kubectl apply -f replicaset.yaml',
        'kubectl create -f replicaset.yaml --kind ReplicaSet',
        'kubectl run -f replicaset.yaml',
        'kubectl replicaset create -f replicaset.yaml'
      ],
      correctAnswer: 0
    }
  ]
}
