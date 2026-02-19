import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What is the main role of an Ingress resource?',
      options: [
        'Store Secrets',
        'Route external HTTP/HTTPS traffic to Services',
        'Schedule Pods to nodes',
        'Run periodic Jobs'
      ],
      correctAnswer: 1
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'What component is required to make Ingress rules effective?',
      options: [
        'CoreDNS',
        'Ingress Controller',
        'Metrics Server',
        'etcd backup controller'
      ],
      correctAnswer: 1
    }
  ]
}
