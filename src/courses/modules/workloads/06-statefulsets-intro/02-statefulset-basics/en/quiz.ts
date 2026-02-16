import type { Quiz } from '~/types/quiz'

export const quiz: Quiz = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      question: 'What distinguishes a StatefulSet from a Deployment?',
      options: [
        'StatefulSet provides stable Pod identity and ordered operations',
        'StatefulSet can only run on one node',
        'StatefulSet does not support scaling',
        'StatefulSet replaces Services'
      ],
      correctAnswer: 0
    },
    {
      id: 'q2',
      type: 'multiple-choice',
      question: 'Which Service type is typically paired with StatefulSets for stable network IDs?',
      options: ['LoadBalancer', 'ExternalName', 'Headless Service', 'NodePort'],
      correctAnswer: 2
    }
  ]
}
