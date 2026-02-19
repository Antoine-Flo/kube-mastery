// ═══════════════════════════════════════════════════════════════════════════
// QUIZ - Cluster Architecture
// ═══════════════════════════════════════════════════════════════════════════

import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the role of etcd in a Kubernetes cluster?',
      options: [
        'Schedules Pods to nodes',
        'Stores all API server data as a key-value store',
        'Runs containers',
        'Manages network rules'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which component is responsible for assigning Pods to nodes?',
      options: ['kubelet', 'kube-scheduler', 'kube-apiserver', 'kube-proxy'],
      correctAnswer: 1
    },
    {
      id: 'q3',
      type: 'multiple-choice',
      question: 'What does the kubelet do on worker nodes?',
      options: [
        'Exposes the Kubernetes API',
        'Ensures that Pods and their containers are running',
        'Schedules Pods',
        'Stores cluster state'
      ],
      correctAnswer: 1
    }
  ]
}
